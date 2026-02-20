import { Hono } from "hono";
import { existsSync, appendFileSync, mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import type { FileNodeConfig, FileAppendResponse } from "../types/index.js";
import { validateAndResolvePath } from "../utils/pathValidator.js";
import { extractPath } from "../utils/extractPath.js";

export function appendRoute(config: FileNodeConfig): Hono {
  const app = new Hono();

  app.post("/append/*", async (c) => {
    const pathToResolve = extractPath(c, "append");

    const result = validateAndResolvePath(pathToResolve, config.allowedPaths);

    if (!result.valid) {
      return c.json({ error: result.error }, (result.status ?? 403) as any);
    }

    let body: { content: string };
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

    const dir = dirname(result.resolvedPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    appendFileSync(result.resolvedPath, body.content, "utf-8");

    const stats = statSync(result.resolvedPath);
    const response: FileAppendResponse = {
      path: result.resolvedPath,
      appended: true,
      newSize: stats.size,
    };

    return c.json(response);
  });

  return app;
}
