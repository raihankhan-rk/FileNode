import { Hono } from "hono";
import { existsSync, mkdirSync } from "node:fs";
import type { FileNodeConfig, MkdirResponse } from "../types/index.js";
import { validateAndResolvePath } from "../utils/pathValidator.js";
import { extractPath } from "../utils/extractPath.js";

export function mkdirRoute(config: FileNodeConfig): Hono {
  const app = new Hono();

  app.post("/mkdir/*", (c) => {
    const pathToResolve = extractPath(c, "mkdir");

    const result = validateAndResolvePath(pathToResolve, config.allowedPaths);

    if (!result.valid) {
      return c.json({ error: result.error }, (result.status ?? 403) as any);
    }

    if (existsSync(result.resolvedPath)) {
      return c.json({ error: "Path already exists" }, 409);
    }

    mkdirSync(result.resolvedPath, { recursive: true });

    const response: MkdirResponse = {
      path: result.resolvedPath,
      created: true,
    };

    return c.json(response, 201);
  });

  return app;
}
