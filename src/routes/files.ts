import { Hono } from "hono";
import { statSync } from "node:fs";
import type { FileNodeConfig } from "../types/index.js";
import { extractPath } from "../utils/extractPath.js";
import { readFileCore } from "../core/index.js";
import { validateAndResolvePath } from "../utils/pathValidator.js";
import { parseMaxFileSize } from "../utils/config.js";

export function filesReadRoute(config: FileNodeConfig): Hono {
  const app = new Hono();
  const maxSize = parseMaxFileSize(config.maxFileSize);

  app.get("/files/*", (c) => {
    const pathToResolve = extractPath(c, "files");
    const format = c.req.query("format") as
      | "text"
      | "json"
      | "base64"
      | undefined;
    const linesParam = c.req.query("lines");
    const lines = linesParam ? parseInt(linesParam, 10) : undefined;

    // For large files (>10MB), stream using Bun.file() directly
    const pathResult = validateAndResolvePath(
      pathToResolve,
      config.allowedPaths,
      true,
    );
    if (pathResult.valid) {
      const stats = statSync(pathResult.resolvedPath);
      if (!stats.isDirectory() && stats.size > 10 * 1024 * 1024 && stats.size <= maxSize) {
        const { getMimeType } = require("../core/readFile.js");
        const mimeType = getMimeType(pathResult.resolvedPath);
        const file = Bun.file(pathResult.resolvedPath);
        return new Response(file.stream(), {
          headers: {
            "Content-Type": mimeType,
            "Content-Length": String(stats.size),
          },
        });
      }
    }

    const result = readFileCore({ path: pathToResolve, format, lines }, config);

    if (!result.ok) {
      return c.json({ error: result.error }, result.status as any);
    }

    const { data } = result;

    if (data.isText) {
      if (format === "json" || data.mimeType === "application/json") {
        return c.json(JSON.parse(data.content as string));
      }
      c.header("Content-Type", data.mimeType);
      return c.text(data.content as string);
    }

    return new Response(data.content as Buffer, {
      headers: {
        "Content-Type": data.mimeType,
        "Content-Length": String(data.size),
      },
    });
  });

  return app;
}
