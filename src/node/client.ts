import { randomUUID } from "node:crypto";
import {
  loadNodeIdentity,
  saveNodeIdentity,
  signNonce,
  type NodeIdentity,
} from "./identity.js";

const VERSION = "0.1.0";
const PROTOCOL_VERSION = 3;

export type CommandHandler = (
  command: string,
  params: Record<string, unknown>,
) => Promise<unknown>;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface GatewayClientOptions {
  gatewayUrl: string;
  commands: string[];
  displayName?: string;
  onCommand: CommandHandler;
  onStatusChange?: (status: GatewayStatus) => void;
}

export type GatewayStatus =
  | "connecting"
  | "challenge"
  | "waiting_approval"
  | "connected"
  | "disconnected"
  | "error";

export class GatewayClient {
  private ws: WebSocket | null = null;
  private identity: NodeIdentity;
  private options: GatewayClientOptions;
  private pending = new Map<string, PendingRequest>();
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private status: GatewayStatus = "disconnected";
  private shouldReconnect = true;
  private tickIntervalMs = 30000;

  constructor(options: GatewayClientOptions) {
    this.options = options;
    this.identity = loadNodeIdentity();
  }

  getStatus(): GatewayStatus {
    return this.status;
  }

  getDeviceId(): string {
    return this.identity.deviceId;
  }

  connect(): void {
    this.shouldReconnect = true;
    this.setStatus("connecting");

    const url = this.options.gatewayUrl.replace(/^http/, "ws");
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(
          typeof event.data === "string"
            ? event.data
            : new TextDecoder().decode(event.data as ArrayBuffer),
        );
        this.handleMessage(msg);
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.cleanup();
      this.setStatus("disconnected");
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.setStatus("error");
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.cleanup();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus("disconnected");
  }

  private setStatus(status: GatewayStatus) {
    this.status = status;
    this.options.onStatusChange?.(status);
  }

  private cleanup() {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    for (const [, req] of this.pending) {
      clearTimeout(req.timer);
      req.reject(new Error("Connection closed"));
    }
    this.pending.clear();
  }

  private scheduleReconnect() {
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2,
      this.maxReconnectDelay,
    );
  }

  private send(msg: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private sendRequest(
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request ${method} timed out`));
      }, 30000);

      this.pending.set(id, { resolve, reject, timer });
      this.send({ type: "req", id, method, params });
    });
  }

  private handleMessage(msg: any) {
    if (msg.type === "res" && msg.id && this.pending.has(msg.id)) {
      const req = this.pending.get(msg.id)!;
      this.pending.delete(msg.id);
      clearTimeout(req.timer);

      if (msg.error) {
        req.reject(new Error(msg.error.message ?? JSON.stringify(msg.error)));
      } else {
        req.resolve(msg.result);
      }
      return;
    }

    switch (msg.method ?? msg.type) {
      case "connect.challenge":
        this.handleChallenge(msg);
        break;
      case "hello-ok":
        this.handleHelloOk(msg);
        break;
      case "hello-err":
        this.handleHelloErr(msg);
        break;
      case "node.invoke":
        this.handleInvoke(msg);
        break;
      case "ping":
        this.send({ type: "pong" });
        break;
      default:
        break;
    }
  }

  private handleChallenge(msg: any) {
    this.setStatus("challenge");
    const nonce = msg.params?.nonce ?? msg.nonce;

    if (!nonce) return;

    const signature = signNonce(nonce, this.identity.privateKey);
    const signedAt = new Date().toISOString();

    this.sendRequest("connect", {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        id: "filenode",
        version: VERSION,
        platform: process.platform,
        mode: "node",
      },
      role: "node",
      scopes: [],
      caps: ["filesystem"],
      commands: this.options.commands,
      permissions: {},
      auth: { token: this.identity.deviceToken || "" },
      device: {
        id: this.identity.deviceId,
        publicKey: this.identity.publicKey,
        signature,
        signedAt,
        nonce,
      },
      displayName: this.options.displayName ?? "FileNode",
    })
      .then((result: any) => {
        if (result?.deviceToken) {
          this.identity.deviceToken = result.deviceToken;
          saveNodeIdentity(this.identity);
          this.onConnected(result);
        } else if (result?.status === "pending" || result?.approval === "pending") {
          this.setStatus("waiting_approval");
        } else {
          this.onConnected(result);
        }
      })
      .catch(() => {
        this.setStatus("waiting_approval");
      });
  }

  private handleHelloOk(msg: any) {
    const result = msg.result ?? msg.params ?? msg;
    if (result.deviceToken) {
      this.identity.deviceToken = result.deviceToken;
      saveNodeIdentity(this.identity);
    }
    this.onConnected(result);
  }

  private onConnected(result: any) {
    this.setStatus("connected");
    if (result?.tickIntervalMs) {
      this.tickIntervalMs = result.tickIntervalMs;
    }
    this.startKeepalive();
  }

  private handleHelloErr(msg: any) {
    const error = msg.error ?? msg.params?.error ?? "Unknown error";
    console.error("Gateway rejected connection:", error);
    this.setStatus("error");
  }

  private async handleInvoke(msg: any) {
    const { id } = msg;
    const command = msg.params?.command ?? msg.params?.method;
    const params = msg.params?.args ?? msg.params?.params ?? {};

    try {
      const result = await this.options.onCommand(command, params);
      this.send({
        type: "res",
        id,
        result,
      });
    } catch (err: any) {
      this.send({
        type: "res",
        id,
        error: {
          code: err.status ?? 500,
          message: err.message ?? "Internal error",
        },
      });
    }
  }

  private startKeepalive() {
    if (this.keepaliveTimer) clearInterval(this.keepaliveTimer);
    this.keepaliveTimer = setInterval(() => {
      this.send({ type: "ping" });
    }, this.tickIntervalMs);
  }
}
