import { statSync, rmSync } from "node:fs";
import type { FileNodeConfig } from "../types/index.js";
import { validateAndResolvePath } from "../utils/pathValidator.js";
import type { CoreResult, DeleteFileParams } from "./types.js";

export function deleteFileCore(
  params: DeleteFileParams,
  config: FileNodeConfig,
): CoreResult<{ deleted: true }> {
  const result = validateAndResolvePath(
    params.path,
    config.allowedPaths,
    true,
  );

  if (!result.valid) {
    return { ok: false, error: result.error, status: result.status ?? 403 };
  }

  const stats = statSync(result.resolvedPath);
  const recursive = params.recursive ?? false;

  if (stats.isDirectory()) {
    if (!recursive) {
      return {
        ok: false,
        error: "Cannot delete directory without recursive=true",
        status: 400,
      };
    }
    rmSync(result.resolvedPath, { recursive: true, force: true });
  } else {
    rmSync(result.resolvedPath);
  }

  return { ok: true, data: { deleted: true } };
}
