import { Hono } from "hono";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import type { FileNodeConfig, FileWriteResponse } from "../types/index.js";
import { validateAndResolvePath } from "../utils/pathValidator.js";
import { parseMaxFileSize } from "../utils/config.js";
import { extractPath } from "../utils/extractPath.js";

export function writeRoute(config: FileNodeConfig): Hono {
  const app = new Hono();
  const maxSize = parseMaxFileSize(config.maxFileSize);

  app.post("/files/*", async (c) => {
    const pathToResolve = extractPath(c, "files");

    const result = validateAndResolvePath(pathToResolve, config.allowedPaths);

    if (!result.valid) {
      return c.json({ error: result.error }, (result.status ?? 403) as any);
    }

    let body: { content: string; encoding?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { error: 'Invalid JSON body. Expected: { "content": "..." }' },
        400,
      );
    }

    if (typeof body.content !== "string") {
      return c.json({ error: '"content" field is required and must be a string' }, 400);
    }

    const contentBytes = Buffer.byteLength(body.content, (body.encoding as BufferEncoding) ?? "utf-8");
    if (contentBytes > maxSize) {
      return c.json(
        { error: `Content too large (${contentBytes} bytes). Max: ${config.maxFileSize}` },
        413,
      );
    }

    const dir = dirname(result.resolvedPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const isNew = !existsSync(result.resolvedPath);

    // Atomic write: write to temp file, then rename
    const tmpPath = result.resolvedPath + `.tmp.${randomBytes(4).toString("hex")}`;
    try {
      writeFileSync(tmpPath, body.content, {
        encoding: (body.encoding as BufferEncoding) ?? "utf-8",
      });
      const { renameSync } = await import("node:fs");
      renameSync(tmpPath, result.resolvedPath);
    } catch (err) {
      // Clean up temp file on failure
      try {
        const { unlinkSync } = await import("node:fs");
        unlinkSync(tmpPath);
      } catch {
        // ignore cleanup errors
      }
      throw err;
    }

    const stats = statSync(result.resolvedPath);
    const response: FileWriteResponse = {
      path: result.resolvedPath,
      size: stats.size,
      created: isNew,
    };

    return c.json(response, isNew ? 201 : 200);
  });

  return app;
}
