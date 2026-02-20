import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { FileNodeConfig } from "../types/index.js";
import { generateToken } from "./crypto.js";

const CONFIG_DIR = join(homedir(), ".filenode");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");
const PID_PATH = join(CONFIG_DIR, "filenode.pid");

function defaultConfig(): FileNodeConfig {
  return {
    version: "0.1.0",
    port: 3333,
    host: "0.0.0.0",
    token: generateToken(),
    allowedPaths: [join(homedir(), "Documents"), join(homedir(), "Desktop")],
    maxFileSize: "1GB",
    maxListDepth: 3,
    rateLimitPerMin: 100,
    enableLogging: true,
    logLevel: "info",
    enableCORS: true,
    corsOrigins: ["*"],
    enableHTTPS: false,
    certPath: null,
    keyPath: null,
  };
}

export function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): FileNodeConfig {
  ensureConfigDir();

  if (!existsSync(CONFIG_PATH)) {
    const config = defaultConfig();
    saveConfig(config);
    return config;
  }

  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const loaded = JSON.parse(raw) as Partial<FileNodeConfig>;
    return { ...defaultConfig(), ...loaded };
  } catch {
    const config = defaultConfig();
    saveConfig(config);
    return config;
  }
}

export function saveConfig(config: FileNodeConfig): void {
  ensureConfigDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function writePidFile(pid: number): void {
  ensureConfigDir();
  writeFileSync(PID_PATH, String(pid), { mode: 0o600 });
}

export function readPidFile(): number | null {
  try {
    const raw = readFileSync(PID_PATH, "utf-8").trim();
    const pid = parseInt(raw, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

export function removePidFile(): void {
  try {
    const { unlinkSync } = require("node:fs");
    unlinkSync(PID_PATH);
  } catch {
    // ignore
  }
}

export function parseMaxFileSize(size: string): number {
  const units: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
  };

  const match = size.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
  if (!match) return 1024 ** 3; // default 1GB

  return parseFloat(match[1]) * (units[match[2].toUpperCase()] ?? 1024 ** 3);
}
