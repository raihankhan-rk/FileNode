import type { Context, Next } from "hono";
import type { RateLimitEntry } from "../types/index.js";

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

export function rateLimitMiddleware(maxPerMinute: number) {
  return async (c: Context, next: Next) => {
    cleanup();

    const key = c.get("token") ?? c.req.header("x-forwarded-for") ?? "anonymous";
    const now = Date.now();

    let entry = store.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + 60_000 };
      store.set(key, entry);
    }

    entry.count++;

    if (entry.count > maxPerMinute) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.header("Retry-After", String(retryAfter));
      return c.json(
        {
          error: "Too many requests",
          retryAfter,
        },
        429,
      );
    }

    c.header("X-RateLimit-Limit", String(maxPerMinute));
    c.header("X-RateLimit-Remaining", String(maxPerMinute - entry.count));
    c.header("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    await next();
  };
}
