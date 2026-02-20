import { Hono } from "hono";
import { statSync, readFileSync } from "node:fs";
import { extname } from "node:path";
import type { FileNodeConfig } from "../types/index.js";
import { validateAndResolvePath } from "../utils/pathValidator.js";
import { parseMaxFileSize } from "../utils/config.js";
import { extractPath } from "../utils/extractPath.js";

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

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

function isTextFile(mimeType: string): boolean {
  return (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/javascript" ||
    mimeType === "application/typescript" ||
    mimeType === "application/xml"
  );
}

export function filesReadRoute(config: FileNodeConfig): Hono {
  const app = new Hono();
  const maxSize = parseMaxFileSize(config.maxFileSize);

  app.get("/files/*", (c) => {
    const pathToResolve = extractPath(c, "files");

    const result = validateAndResolvePath(
      pathToResolve,
      config.allowedPaths,
      true,
    );

    if (!result.valid) {
      return c.json({ error: result.error }, (result.status ?? 403) as any);
    }

    const stats = statSync(result.resolvedPath);
    if (stats.isDirectory()) {
      return c.json(
        { error: "Path is a directory. Use /list/ endpoint instead." },
        400,
      );
    }

    if (stats.size > maxSize) {
      return c.json(
        { error: `File too large (${stats.size} bytes). Max: ${config.maxFileSize}` },
        413,
      );
    }

    const mimeType = getMimeType(result.resolvedPath);
    const format = c.req.query("format");
    const linesParam = c.req.query("lines");

    // For large files (>10MB), stream using Bun.file()
    if (stats.size > 10 * 1024 * 1024) {
      const file = Bun.file(result.resolvedPath);
      return new Response(file.stream(), {
        headers: {
          "Content-Type": mimeType,
          "Content-Length": String(stats.size),
        },
      });
    }

    if (format === "base64") {
      const content = readFileSync(result.resolvedPath);
      return c.text(content.toString("base64"));
    }

    if (isTextFile(mimeType) || format === "text") {
      const content = readFileSync(result.resolvedPath, "utf-8");

      if (linesParam) {
        const lines = parseInt(linesParam, 10);
        if (isNaN(lines) || lines < 1) {
          return c.json({ error: "lines must be a positive integer" }, 400);
        }
        const truncated = content.split("\n").slice(0, lines).join("\n");
        c.header("Content-Type", "text/plain");
        return c.text(truncated);
      }

      if (format === "json" || mimeType === "application/json") {
        try {
          const parsed = JSON.parse(content);
          return c.json(parsed);
        } catch {
          return c.json({ error: "File is not valid JSON" }, 400);
        }
      }

      c.header("Content-Type", mimeType);
      return c.text(content);
    }

    // Binary files
    const content = readFileSync(result.resolvedPath);
    return new Response(content, {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(stats.size),
      },
    });
  });

  return app;
}
