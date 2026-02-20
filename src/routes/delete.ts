import { Hono } from "hono";
import { existsSync, rmSync, statSync } from "node:fs";
import type { FileNodeConfig } from "../types/index.js";
import { validateAndResolvePath } from "../utils/pathValidator.js";
import { extractPath } from "../utils/extractPath.js";

export function deleteRoute(config: FileNodeConfig): Hono {
  const app = new Hono();

  app.delete("/files/*", (c) => {
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
    const recursive = c.req.query("recursive") === "true";

    if (stats.isDirectory()) {
      if (!recursive) {
        return c.json(
          { error: "Cannot delete directory without recursive=true" },
          400,
        );
      }
      rmSync(result.resolvedPath, { recursive: true, force: true });
    } else {
      rmSync(result.resolvedPath);
    }

    return c.body(null, 204);
  });

  return app;
}
