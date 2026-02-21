import { statSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import type { FileNodeConfig } from "../types/index.js";
import { validateAndResolvePath } from "../utils/pathValidator.js";
import { parseMaxFileSize } from "../utils/config.js";
import type { CoreResult, ReadFileParams, ReadFileResult } from "./types.js";

const MIME_TYPES: Record<string, string> = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".ts": "application/typescript",
  ".json": "application/json",
  ".xml": "application/xml",
  ".yaml": "text/yaml",
  ".yml": "text/yaml",
  ".csv": "text/csv",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".gz": "application/gzip",
};

export function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

export function isTextFile(mimeType: string): boolean {
  return (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/javascript" ||
    mimeType === "application/typescript" ||
    mimeType === "application/xml"
  );
}

export function readFileCore(
  params: ReadFileParams,
  config: FileNodeConfig,
): CoreResult<ReadFileResult> {
  const result = validateAndResolvePath(params.path, config.allowedPaths, true);

  if (!result.valid) {
    return { ok: false, error: result.error, status: result.status ?? 403 };
  }

  const stats = statSync(result.resolvedPath);
  if (stats.isDirectory()) {
    return {
      ok: false,
      error: "Path is a directory. Use /list/ endpoint instead.",
      status: 400,
    };
  }

  const maxSize = parseMaxFileSize(config.maxFileSize);
  if (stats.size > maxSize) {
    return {
      ok: false,
      error: `File too large (${stats.size} bytes). Max: ${config.maxFileSize}`,
      status: 413,
    };
  }

  const mimeType = getMimeType(result.resolvedPath);
  const format = params.format;
  const linesParam = params.lines;

  if (format === "base64") {
    const content = readFileSync(result.resolvedPath);
    return {
      ok: true,
      data: {
        content: content.toString("base64"),
        mimeType: "text/plain",
        size: stats.size,
        isText: true,
      },
    };
  }

  if (isTextFile(mimeType) || format === "text") {
    let content = readFileSync(result.resolvedPath, "utf-8");

    if (linesParam !== undefined) {
      if (isNaN(linesParam) || linesParam < 1) {
        return {
          ok: false,
          error: "lines must be a positive integer",
          status: 400,
        };
      }
      content = content.split("\n").slice(0, linesParam).join("\n");
    }

    if (format === "json" || mimeType === "application/json") {
      try {
        JSON.parse(content);
      } catch {
        return { ok: false, error: "File is not valid JSON", status: 400 };
      }
    }

    return {
      ok: true,
      data: { content, mimeType, size: stats.size, isText: true },
    };
  }

  const content = readFileSync(result.resolvedPath);
  return {
    ok: true,
    data: { content, mimeType, size: stats.size, isText: false },
  };
}
