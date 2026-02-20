import type { Context, Next } from "hono";
import type { Logger } from "pino";

export function loggingMiddleware(logger: Logger) {
  return async (c: Context, next: Next) => {
    const start = performance.now();
    const method = c.req.method;
    const path = c.req.path;

    await next();

    const duration = (performance.now() - start).toFixed(2);
    const status = c.res.status;

    logger.info(
      {
        method,
        path,
        status,
        duration: `${duration}ms`,
      },
      `${method} ${path} ${status} ${duration}ms`,
    );
  };
}
