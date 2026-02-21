export { GatewayClient, type GatewayClientOptions, type GatewayStatus } from "./client.js";
export { createCommandHandler, NODE_COMMANDS } from "./commands.js";
export { loadNodeIdentity, saveNodeIdentity, signNonce, getNodeIdentityPath } from "./identity.js";
export type { NodeIdentity } from "./identity.js";
