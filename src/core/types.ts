import type { DirectoryEntry } from "../types/index.js";

export type CoreResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number };

export interface ListDirParams {
  path: string;
  recursive?: boolean;
  maxDepth?: number;
}

export interface ListDirResult {
  path: string;
  type: "directory";
  contents: DirectoryEntry[];
}

export interface ReadFileParams {
  path: string;
  format?: "text" | "json" | "base64";
  lines?: number;
}

export interface ReadFileResult {
  content: string | Buffer;
  mimeType: string;
  size: number;
  isText: boolean;
}

export interface WriteFileParams {
  path: string;
  content: string;
  encoding?: string;
}

export interface WriteFileResult {
  path: string;
  size: number;
  created: boolean;
}

export interface AppendFileParams {
  path: string;
  content: string;
}

export interface AppendFileResult {
  path: string;
  appended: boolean;
  newSize: number;
}

export interface DeleteFileParams {
  path: string;
  recursive?: boolean;
}

export interface MkdirParams {
  path: string;
}

export interface MkdirResult {
  path: string;
  created: boolean;
}
