export interface FileNodeConfig {
  version: string;
  port: number;
  host: string;
  allowedPaths: string[];
  maxFileSize: string;
  maxListDepth: number;
  rateLimitPerMin: number;
  enableLogging: boolean;
  logLevel: string;
  enableCORS: boolean;
  corsOrigins: string[];
  enableHTTPS: boolean;
  certPath: string | null;
  keyPath: string | null;
  gateway: string | null;
  displayName: string;
}

export interface DirectoryEntry {
  name: string;
  type: "file" | "directory";
  size?: number;
  modified?: string;
  contents?: DirectoryEntry[];
}

export interface DirectoryListing {
  path: string;
  type: "directory";
  contents: DirectoryEntry[];
}

export interface FileWriteResponse {
  path: string;
  size: number;
  created: boolean;
}

export interface FileAppendResponse {
  path: string;
  appended: boolean;
  newSize: number;
}

export interface MkdirResponse {
  path: string;
  created: boolean;
}

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: string;
}

export interface HealthResponse {
  status: "healthy";
  version: string;
  uptime: number;
}

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

