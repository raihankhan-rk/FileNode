import type { FileNodeConfig } from "../types/index.js";
import {
  listDir,
  readFileCore,
  writeFileCore,
  appendFileCore,
  deleteFileCore,
  mkdirCore,
  getDiscoveryInfo,
} from "../core/index.js";
import type { CommandHandler } from "./client.js";

export const NODE_COMMANDS = [
  "files.list",
  "files.read",
  "files.write",
  "files.append",
  "files.delete",
  "files.mkdir",
  "files.info",
];

class CommandError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function unwrap<T>(result: { ok: true; data: T } | { ok: false; error: string; status: number }): T {
  if (!result.ok) {
    throw new CommandError(result.error, result.status);
  }
  return result.data;
}

export function createCommandHandler(config: FileNodeConfig): CommandHandler {
  return async (command: string, params: Record<string, unknown>) => {
    switch (command) {
      case "files.list": {
        const path = (params.path as string) ?? "/";
        const recursive = (params.recursive as boolean) ?? false;
        const maxDepth = params.maxDepth as number | undefined;
        return unwrap(listDir({ path, recursive, maxDepth }, config));
      }

      case "files.read": {
        const path = params.path as string;
        if (!path) throw new CommandError("path is required", 400);
        const format = params.format as "text" | "json" | "base64" | undefined;
        const lines = params.lines as number | undefined;
        const result = unwrap(readFileCore({ path, format, lines }, config));

        if (Buffer.isBuffer(result.content)) {
          return {
            content: result.content.toString("base64"),
            mimeType: result.mimeType,
            size: result.size,
            encoding: "base64",
          };
        }
        return {
          content: result.content,
          mimeType: result.mimeType,
          size: result.size,
          encoding: "utf-8",
        };
      }

      case "files.write": {
        const path = params.path as string;
        if (!path) throw new CommandError("path is required", 400);
        const content = params.content as string;
        if (content === undefined) throw new CommandError("content is required", 400);
        const encoding = params.encoding as string | undefined;
        return unwrap(writeFileCore({ path, content, encoding }, config));
      }

      case "files.append": {
        const path = params.path as string;
        if (!path) throw new CommandError("path is required", 400);
        const content = params.content as string;
        if (content === undefined) throw new CommandError("content is required", 400);
        return unwrap(appendFileCore({ path, content }, config));
      }

      case "files.delete": {
        const path = params.path as string;
        if (!path) throw new CommandError("path is required", 400);
        const recursive = (params.recursive as boolean) ?? false;
        return unwrap(deleteFileCore({ path, recursive }, config));
      }

      case "files.mkdir": {
        const path = params.path as string;
        if (!path) throw new CommandError("path is required", 400);
        return unwrap(mkdirCore({ path }, config));
      }

      case "files.info": {
        return getDiscoveryInfo(config);
      }

      default:
        throw new CommandError(`Unknown command: ${command}`, 404);
    }
  };
}
