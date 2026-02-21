import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync, createHash, sign } from "node:crypto";

function getConfigDir() {
  return join(homedir(), ".filenode");
}

function getNodePath() {
  return join(getConfigDir(), "node.json");
}

export interface NodeIdentity {
  deviceId: string;
  publicKey: string;
  privateKey: string;
  deviceToken: string;
}

function fingerprint(publicKeyPem: string): string {
  return createHash("sha256").update(publicKeyPem).digest("hex").slice(0, 16);
}

function generateIdentity(): NodeIdentity {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  return {
    deviceId: fingerprint(publicKey),
    publicKey,
    privateKey,
    deviceToken: "",
  };
}

export function loadNodeIdentity(): NodeIdentity {
  const configDir = getConfigDir();
  const nodePath = getNodePath();

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  if (existsSync(nodePath)) {
    try {
      const raw = readFileSync(nodePath, "utf-8");
      const data = JSON.parse(raw) as Partial<NodeIdentity>;
      if (data.deviceId && data.publicKey && data.privateKey) {
        return {
          deviceId: data.deviceId,
          publicKey: data.publicKey,
          privateKey: data.privateKey,
          deviceToken: data.deviceToken ?? "",
        };
      }
    } catch {
      // corrupted file, regenerate
    }
  }

  const identity = generateIdentity();
  saveNodeIdentity(identity);
  return identity;
}

export function saveNodeIdentity(identity: NodeIdentity): void {
  const configDir = getConfigDir();
  const nodePath = getNodePath();

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }
  writeFileSync(nodePath, JSON.stringify(identity, null, 2), { mode: 0o600 });
}

export function signNonce(nonce: string, privateKeyPem: string): string {
  const signature = sign(null, Buffer.from(nonce), privateKeyPem);
  return signature.toString("base64");
}

export function getNodeIdentityPath(): string {
  return getNodePath();
}
