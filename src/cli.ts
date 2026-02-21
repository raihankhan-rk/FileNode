#!/usr/bin/env bun
import {
  loadConfig,
  saveConfig,
  getConfigPath,
  getConfigDir,
  readPidFile,
} from "./utils/config.js";
import { startServer } from "./index.js";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  GatewayClient,
  createCommandHandler,
  NODE_COMMANDS,
  type GatewayStatus,
} from "./node/index.js";

const VERSION = "0.2.1";

const HELP = `
FileNode v${VERSION} - Ultra-lightweight local file server for AI agents

USAGE:
  filenode <command> [options]

COMMANDS:
  start                Start the FileNode server
  stop                 Stop a running FileNode server
  config show          Display current configuration
  config set <key> <values...>  Update a config value
  config add <paths...>         Add allowed paths (appends to existing)
  config remove <paths...>      Remove allowed paths
  logs                 Show config/log directory info
  help                 Show this help message

OPTIONS:
  --port <number>      Override port (default: 3333)
  --host <string>      Override host (default: 0.0.0.0)
  --gateway <url>      Connect to OpenClaw Gateway as a node (e.g. localhost:18789)
  --version, -v        Show version
  --help, -h           Show help

EXAMPLES:
  filenode start
  filenode start --port 8080
  filenode start --gateway localhost:18789
  filenode start --gateway localhost:18789 --port 3333
  filenode config add ~/Projects ~/Downloads
  filenode config remove ~/Desktop
  filenode config set allowedPaths ~/Documents ~/Projects
  filenode config set gateway localhost:18789
  filenode config set port 4444
`.trim();

function printBanner(port: number, host: string, allowedPaths: string[]) {
  console.log("");
  console.log("  ╔══════════════════════════════════════════╗");
  console.log("  ║           FileNode v" + VERSION + "                ║");
  console.log("  ╠══════════════════════════════════════════╣");
  console.log(`  ║  Server:  http://${host}:${port}`.padEnd(45) + "║");
  console.log(`  ║  Config:  ~/.filenode/config.json`.padEnd(45) + "║");
  console.log("  ╚══════════════════════════════════════════╝");
  console.log("");
  console.log("  Allowed paths:");
  for (const p of allowedPaths) {
    console.log(`    - ${p}`);
  }
  console.log("");
}

function printGatewayBanner(gatewayUrl: string, commands: string[]) {
  console.log("");
  console.log("  ╔══════════════════════════════════════════╗");
  console.log("  ║     FileNode v" + VERSION + " — Node Mode        ║");
  console.log("  ╠══════════════════════════════════════════╣");
  console.log(`  ║  Gateway:  ${gatewayUrl}`.padEnd(45) + "║");
  console.log("  ╚══════════════════════════════════════════╝");
  console.log("");
  console.log("  Commands registered:");
  for (const cmd of commands) {
    console.log(`    • ${cmd}`);
  }
  console.log("");
}

function gatewayStatusLine(status: GatewayStatus): string {
  const labels: Record<GatewayStatus, string> = {
    connecting: "⏳ Connecting to Gateway...",
    challenge: "🔐 Responding to challenge...",
    waiting_approval: '⏳ Pairing requested. Run "openclaw nodes approve" on your gateway.',
    connected: "✅ Connected! FileNode is now available as a node.",
    disconnected: "⚠️  Disconnected from Gateway. Reconnecting...",
    error: "❌ Gateway connection error. Retrying...",
  };
  return labels[status] ?? status;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return;
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(`filenode v${VERSION}`);
    return;
  }

  const command = args[0];

  switch (command) {
    case "start": {
      const config = loadConfig();

      const portIdx = args.indexOf("--port");
      if (portIdx !== -1 && args[portIdx + 1]) {
        config.port = parseInt(args[portIdx + 1], 10);
      }

      const hostIdx = args.indexOf("--host");
      if (hostIdx !== -1 && args[hostIdx + 1]) {
        config.host = args[hostIdx + 1];
      }

      const gatewayIdx = args.indexOf("--gateway");
      let gatewayUrl: string | null = null;
      if (gatewayIdx !== -1 && args[gatewayIdx + 1]) {
        gatewayUrl = args[gatewayIdx + 1];
      } else if (config.gateway) {
        gatewayUrl = config.gateway;
      }

      // Start HTTP server unless --gateway is used without --port
      const startHttp = !gatewayUrl || portIdx !== -1;

      if (startHttp) {
        printBanner(config.port, config.host, config.allowedPaths);
        await startServer(config);
      }

      if (gatewayUrl) {
        const normalizedUrl = gatewayUrl.includes("://")
          ? gatewayUrl
          : `ws://${gatewayUrl}`;

        const commandHandler = createCommandHandler(config);

        printGatewayBanner(normalizedUrl, NODE_COMMANDS);

        const client = new GatewayClient({
          gatewayUrl: normalizedUrl,
          commands: NODE_COMMANDS,
          displayName: config.displayName,
          onCommand: commandHandler,
          onStatusChange: (status) => {
            console.log(`  ${gatewayStatusLine(status)}`);
          },
        });

        client.connect();

        const shutdown = () => {
          client.disconnect();
          process.exit(0);
        };
        process.on("SIGINT", shutdown);
        process.on("SIGTERM", shutdown);

        // Keep the process alive
        await new Promise(() => {});
      }
      break;
    }

    case "stop": {
      const pid = readPidFile();
      if (!pid) {
        console.log("No running FileNode server found.");
        return;
      }
      try {
        process.kill(pid, "SIGTERM");
        console.log(`Stopped FileNode server (PID: ${pid})`);
      } catch {
        console.log("Server process not found. It may have already stopped.");
      }
      break;
    }

    case "config": {
      const config = loadConfig();

      if (args[1] === "show") {
        console.log("FileNode Configuration:");
        console.log(`  Path: ${getConfigPath()}`);
        console.log("");
        console.log(JSON.stringify(config, null, 2));
      } else if (args[1] === "set" && args[2]) {
        const key = args[2];
        const values = args.slice(3);

        if (values.length === 0) {
          console.log(`Usage: filenode config set <key> <value>`);
          return;
        }

        const configAny = config as unknown as Record<string, unknown>;

        if (!(key in configAny)) {
          console.log(`Unknown config key: ${key}`);
          console.log(`Available keys: ${Object.keys(config).join(", ")}`);
          return;
        }

        if (key === "allowedPaths" && values.length === 1 && values[0] === "all") {
          config.allowedPaths = ["/"];
          saveConfig(config);
          console.log("Allowed paths set to ALL (entire filesystem).");
          console.log("Warning: Any request can now access any file on the system.");
          console.log("\nRestart the server for changes to take effect.");
          return;
        }

        if (Array.isArray(configAny[key])) {
          configAny[key] = values.map((v) => {
            if (v.startsWith("~/")) return resolve(process.env.HOME || "", v.slice(2));
            return v;
          });
        } else if (typeof configAny[key] === "number") {
          configAny[key] = parseInt(values[0], 10);
        } else if (typeof configAny[key] === "boolean") {
          configAny[key] = values[0] === "true";
        } else {
          configAny[key] = values[0];
        }

        saveConfig(config);
        console.log(`Updated ${key} = ${JSON.stringify(configAny[key])}`);
      } else if (args[1] === "add") {
        const paths = args.slice(2);
        if (paths.length === 0) {
          console.log("Usage: filenode config add <path> [path2] ...");
          console.log("Example: filenode config add ~/Projects ~/Downloads");
          return;
        }

        const resolved = paths.map((v) => {
          if (v.startsWith("~/")) return resolve(process.env.HOME || "", v.slice(2));
          return resolve(v);
        });

        const existing = new Set(config.allowedPaths);
        const added: string[] = [];
        for (const p of resolved) {
          if (!existing.has(p)) {
            config.allowedPaths.push(p);
            added.push(p);
          }
        }

        if (added.length === 0) {
          console.log("All paths are already in the allowed list.");
        } else {
          saveConfig(config);
          console.log("Added allowed paths:");
          for (const p of added) {
            console.log(`  + ${p}`);
          }
        }

        console.log("\nCurrent allowed paths:");
        for (const p of config.allowedPaths) {
          console.log(`  - ${p}`);
        }
      } else if (args[1] === "remove") {
        const paths = args.slice(2);
        if (paths.length === 0) {
          console.log("Usage: filenode config remove <path> [path2] ...");
          return;
        }

        const toRemove = new Set(
          paths.map((v) => {
            if (v.startsWith("~/")) return resolve(process.env.HOME || "", v.slice(2));
            return resolve(v);
          }),
        );

        const before = config.allowedPaths.length;
        config.allowedPaths = config.allowedPaths.filter((p) => !toRemove.has(p));
        const removed = before - config.allowedPaths.length;

        if (removed === 0) {
          console.log("None of the specified paths were in the allowed list.");
        } else {
          saveConfig(config);
          console.log(`Removed ${removed} path(s).`);
        }

        console.log("\nCurrent allowed paths:");
        for (const p of config.allowedPaths) {
          console.log(`  - ${p}`);
        }
      } else {
        console.log("Usage:");
        console.log("  filenode config show");
        console.log("  filenode config set <key> <value...>");
        console.log("  filenode config add <path> [path2] ...   Add allowed paths");
        console.log("  filenode config remove <path> [path2] ...  Remove allowed paths");
      }
      break;
    }

    case "logs": {
      const dir = getConfigDir();
      console.log(`FileNode config directory: ${dir}`);
      console.log(`Config file: ${getConfigPath()}`);
      if (existsSync(dir)) {
        console.log("Directory exists and is accessible.");
      }
      break;
    }

    case "help":
      console.log(HELP);
      break;

    default:
      console.log(`Unknown command: ${command}`);
      console.log('Run "filenode help" for usage information.');
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
