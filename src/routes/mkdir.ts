import { Hono } from "hono";
import type { FileNodeConfig } from "../types/index.js";
import { extractPath } from "../utils/extractPath.js";
import { mkdirCore } from "../core/index.js";

export function mkdirRoute(config: FileNodeConfig): Hono {
  const app = new Hono();

  app.post("/mkdir/*", (c) => {
    const pathToResolve = extractPath(c, "mkdir");

    const result = mkdirCore({ path: pathToResolve }, config);

    if (!result.ok) {
      return c.json({ error: result.error }, result.status as any);
    }

    return c.json(result.data, 201);
  });

  return app;
}
