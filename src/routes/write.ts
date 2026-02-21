import { Hono } from "hono";
import type { FileNodeConfig } from "../types/index.js";
import { extractPath } from "../utils/extractPath.js";
import { writeFileCore } from "../core/index.js";

export function writeRoute(config: FileNodeConfig): Hono {
  const app = new Hono();

  app.post("/files/*", async (c) => {
    const pathToResolve = extractPath(c, "files");

    let body: { content: string; encoding?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { error: 'Invalid JSON body. Expected: { "content": "..." }' },
        400,
      );
    }

    const result = writeFileCore(
      { path: pathToResolve, content: body.content, encoding: body.encoding },
      config,
    );

    if (!result.ok) {
      return c.json({ error: result.error }, result.status as any);
    }

    return c.json(result.data, result.data.created ? 201 : 200);
  });

  return app;
}
