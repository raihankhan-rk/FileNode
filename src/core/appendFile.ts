import { existsSync, appendFileSync, mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import type { FileNodeConfig } from "../types/index.js";
import { validateAndResolvePath } from "../utils/pathValidator.js";
import type { CoreResult, AppendFileParams, AppendFileResult } from "./types.js";

export function appendFileCore(
  params: AppendFileParams,
  config: FileNodeConfig,
): CoreResult<AppendFileResult> {
  const result = validateAndResolvePath(params.path, config.allowedPaths);

  if (!result.valid) {
    return { ok: false, error: result.error, status: result.status ?? 403 };
  }

  if (typeof params.content !== "string") {
    return {
      ok: false,
      error: '"content" field is required and must be a string',
      status: 400,
    };
  }

  const dir = dirname(result.resolvedPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  appendFileSync(result.resolvedPath, params.content, "utf-8");

  const stats = statSync(result.resolvedPath);
  return {
    ok: true,
    data: {
      path: result.resolvedPath,
      appended: true,
      newSize: stats.size,
    },
  };
}
