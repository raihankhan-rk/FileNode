import { existsSync, mkdirSync } from "node:fs";
import type { FileNodeConfig } from "../types/index.js";
import { validateAndResolvePath } from "../utils/pathValidator.js";
import type { CoreResult, MkdirParams, MkdirResult } from "./types.js";

export function mkdirCore(
  params: MkdirParams,
  config: FileNodeConfig,
): CoreResult<MkdirResult> {
  const result = validateAndResolvePath(params.path, config.allowedPaths);

  if (!result.valid) {
    return { ok: false, error: result.error, status: result.status ?? 403 };
  }

  if (existsSync(result.resolvedPath)) {
    return { ok: false, error: "Path already exists", status: 409 };
  }

  mkdirSync(result.resolvedPath, { recursive: true });

  return {
    ok: true,
    data: {
      path: result.resolvedPath,
      created: true,
    },
  };
}
