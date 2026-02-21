import { Hono } from "hono";
import type { FileNodeConfig } from "../types/index.js";
import { extractPath } from "../utils/extractPath.js";
import { listDir, getDiscoveryInfo } from "../core/index.js";

export function rootRoute(config: FileNodeConfig): Hono {
  const app = new Hono();

  app.get("/", (c) => {
    return c.json(getDiscoveryInfo(config));
  });

  return app;
}

export function listRoute(config: FileNodeConfig): Hono {
  const app = new Hono();

  app.get("/list/*", (c) => {
    const pathToResolve = extractPath(c, "list");
    const recursive = c.req.query("recursive") === "true";
    const maxDepth = c.req.query("maxDepth")
      ? parseInt(c.req.query("maxDepth")!, 10)
      : undefined;

    const result = listDir(
      { path: pathToResolve, recursive, maxDepth },
      config,
    );

    if (!result.ok) {
      return c.json({ error: result.error }, result.status as any);
    }

    return c.json(result.data);
  });

  return app;
}
