import type { Context, Next } from "hono";
import { validateToken } from "../utils/crypto.js";
import type { FileNodeConfig } from "../types/index.js";

export function authMiddleware(config: FileNodeConfig) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("authorization");

    if (!authHeader) {
      return c.json({ error: "Missing Authorization header" }, 401);
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return c.json(
        { error: "Invalid Authorization format. Use: Bearer <token>" },
        401,
      );
    }

    const token = parts[1];
    if (!validateToken(token, config.token)) {
      return c.json({ error: "Invalid token" }, 403);
    }

    c.set("token", token);
    await next();
  };
}
