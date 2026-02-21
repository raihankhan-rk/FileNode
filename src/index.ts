import { loadConfig } from "./utils/config.js";
import { createApp } from "./server.js";
import { writePidFile, removePidFile } from "./utils/config.js";
import type { FileNodeConfig } from "./types/index.js";

export { createApp } from "./server.js";
export { loadConfig, saveConfig, getConfigPath } from "./utils/config.js";
export type { FileNodeConfig } from "./types/index.js";

export async function startServer(configOverrides?: Partial<FileNodeConfig>) {
  const config = { ...loadConfig(), ...configOverrides };
  const { app, logger } = createApp(config);

  const server = Bun.serve({
    port: config.port,
    hostname: config.host,
    fetch: app.fetch,
  });

  writePidFile(process.pid);

  logger.info(`FileNode server running at http://${config.host}:${config.port}`);
  logger.info(`Allowed paths: ${config.allowedPaths.join(", ")}`);

  const shutdown = () => {
    logger.info("Shutting down FileNode server...");
    server.stop();
    removePidFile();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return server;
}
