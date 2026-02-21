import { Hono } from "hono";
import type { FileNodeConfig } from "../types/index.js";
import { extractPath } from "../utils/extractPath.js";
import { deleteFileCore } from "../core/index.js";

export function deleteRoute(config: FileNodeConfig): Hono {
  const app = new Hono();

  app.delete("/files/*", (c) => {
    const pathToResolve = extractPath(c, "files");
    const recursive = c.req.query("recursive") === "true";

    const result = deleteFileCore(
      { path: pathToResolve, recursive },
      config,
    );

    if (!result.ok) {
      return c.json({ error: result.error }, result.status as any);
    }

    return c.body(null, 204);
  });

  return app;
}
