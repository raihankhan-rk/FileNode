import {
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import type { FileNodeConfig } from "../types/index.js";
import { validateAndResolvePath } from "../utils/pathValidator.js";
import { parseMaxFileSize } from "../utils/config.js";
import type { CoreResult, WriteFileParams, WriteFileResult } from "./types.js";

export function writeFileCore(
  params: WriteFileParams,
  config: FileNodeConfig,
): CoreResult<WriteFileResult> {
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

  const maxSize = parseMaxFileSize(config.maxFileSize);
  const encoding = (params.encoding as BufferEncoding) ?? "utf-8";
  const contentBytes = Buffer.byteLength(params.content, encoding);
  if (contentBytes > maxSize) {
    return {
      ok: false,
      error: `Content too large (${contentBytes} bytes). Max: ${config.maxFileSize}`,
      status: 413,
    };
  }

  const dir = dirname(result.resolvedPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const isNew = !existsSync(result.resolvedPath);

  const tmpPath =
    result.resolvedPath + `.tmp.${randomBytes(4).toString("hex")}`;
  try {
    writeFileSync(tmpPath, params.content, { encoding });
    renameSync(tmpPath, result.resolvedPath);
  } catch (err) {
    try {
      unlinkSync(tmpPath);
    } catch {
      // ignore cleanup errors
    }
    throw err;
  }

  const stats = statSync(result.resolvedPath);
  return {
    ok: true,
    data: {
      path: result.resolvedPath,
      size: stats.size,
      created: isNew,
    },
  };
}
