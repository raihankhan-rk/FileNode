import type { Context, Next } from "hono";
import type { ErrorResponse } from "../types/index.js";

export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));

    const status = getStatusFromError(error);
    const response: ErrorResponse = {
      error: error.message || "Internal server error",
    };

    if (error.name) {
      response.code = error.name;
    }

    return c.json(response, status as any);
  }
}

function getStatusFromError(error: Error): number {
  if (error.message.includes("not found") || error.message.includes("ENOENT"))
    return 404;
  if (error.message.includes("Access denied") || error.message.includes("denied"))
    return 403;
  if (error.message.includes("Invalid") || error.message.includes("cannot be empty"))
    return 400;
  if (error.message.includes("Too large") || error.message.includes("size"))
    return 413;
  return 500;
}
