import { Hono } from "hono";
import type { HealthResponse } from "../types/index.js";

const startTime = Date.now();

export function healthRoute(): Hono {
  const app = new Hono();

  app.get("/health", (c) => {
    const response: HealthResponse = {
      status: "healthy",
      version: "0.1.0",
      uptime: Math.floor((Date.now() - startTime) / 1000),
    };
    return c.json(response);
  });

  return app;
}
