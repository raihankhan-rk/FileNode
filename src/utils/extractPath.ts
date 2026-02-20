import type { Context } from "hono";

/**
 * Extract the target file/dir path from a request.
 * Prefers the `?path=` query parameter (handles special characters reliably),
 * falls back to the URL path segment after the route prefix.
 */
export function extractPath(c: Context, prefix: string): string {
  const queryPath = c.req.query("path");
  if (queryPath) {
    return queryPath.startsWith("/") ? queryPath : "/" + queryPath;
  }

  const raw = c.req.path.replace(new RegExp(`^/${prefix}/?`), "") || ".";
  const decoded = decodeURIComponent(raw);
  return decoded.startsWith("/") ? decoded : "/" + decoded;
}
