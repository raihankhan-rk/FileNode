import { Hono } from "hono";
import type { FileNodeConfig } from "../types/index.js";
import { extractPath } from "../utils/extractPath.js";
import { appendFileCore } from "../core/index.js";

export function appendRoute(config: FileNodeConfig): Hono {
  const app = new Hono();

  app.post("/append/*", async (c) => {
    const pathToResolve = extractPath(c, "append");

    let body: { content: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { error: 'Invalid JSON body. Expected: { "content": "..." }' },
        400,
      );
    }

    const result = appendFileCore(
      { path: pathToResolve, content: body.content },
      config,
    );

    if (!result.ok) {
      return c.json({ error: result.error }, result.status as any);
    }

    return c.json(result.data);
  });

  return app;
}
