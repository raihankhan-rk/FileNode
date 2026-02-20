import { Hono } from "hono";
import { cors } from "hono/cors";
import pino from "pino";
import type { FileNodeConfig } from "./types/index.js";
import { authMiddleware } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { loggingMiddleware } from "./middleware/logging.js";
import { rateLimitMiddleware } from "./middleware/rateLimit.js";
import { securityHeaders } from "./middleware/securityHeaders.js";
import { healthRoute } from "./routes/health.js";
import { listRoute, rootRoute } from "./routes/list.js";
import { filesReadRoute } from "./routes/files.js";
import { writeRoute } from "./routes/write.js";
import { appendRoute } from "./routes/append.js";
import { deleteRoute } from "./routes/delete.js";
import { mkdirRoute } from "./routes/mkdir.js";

export function createApp(config: FileNodeConfig) {
  const app = new Hono();

  const logger = pino({
    level: config.logLevel,
    enabled: config.enableLogging,
    transport: config.enableLogging
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  });

  // Global middleware
  app.use("*", errorHandler);
  app.use("*", securityHeaders);

  if (config.enableLogging) {
    app.use("*", loggingMiddleware(logger));
  }

  if (config.enableCORS) {
    app.use(
      "*",
      cors({
        origin: config.corsOrigins.includes("*") ? "*" : config.corsOrigins,
        allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
        allowHeaders: ["Authorization", "Content-Type"],
      }),
    );
  }

  // Health check (no auth required)
  app.route("/", healthRoute());

  // Auth + rate limit for all other routes
  app.use("*", authMiddleware(config));
  app.use("*", rateLimitMiddleware(config.rateLimitPerMin));

  // Root discovery endpoint
  app.route("/", rootRoute(config));

  // File operation routes
  // DELETE must be registered before GET to avoid conflicts on /files/*
  app.route("/", deleteRoute(config));
  app.route("/", writeRoute(config));
  app.route("/", listRoute(config));
  app.route("/", filesReadRoute(config));
  app.route("/", appendRoute(config));
  app.route("/", mkdirRoute(config));

  // 404 fallback
  app.notFound((c) => {
    return c.json(
      {
        error: "Not found",
        hint: "Try GET / to discover all available directories.",
        availableEndpoints: [
          "GET /           — discover all allowed directories",
          "GET /health     — server status",
          "GET /list/:path — list directory contents",
          "GET /files/:path — read a file",
          "POST /files/:path — write a file",
          "POST /append/:path — append to a file",
          "DELETE /files/:path — delete a file",
          "POST /mkdir/:path — create a directory",
        ],
      },
      404,
    );
  });

  return { app, logger };
}
