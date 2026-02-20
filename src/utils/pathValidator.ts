import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, normalize, sep, dirname, basename } from "node:path";

export function expandTilde(p: string): string {
  if (p === "~" || p.startsWith("~" + sep) || p.startsWith("~/")) {
    return resolve(homedir(), p.slice(2));
  }
  return p;
}

export function normalizePath(basePath: string, userPath: string): string {
  const expanded = expandTilde(userPath);
  if (expanded.startsWith("/") || expanded.startsWith("~")) {
    return normalize(resolve(expanded));
  }
  return normalize(resolve(basePath, expanded));
}

export function isPathAllowed(
  targetPath: string,
  allowedPaths: string[],
): boolean {
  if (allowedPaths.includes("/")) return true;

  const normalizedTarget = normalize(resolve(expandTilde(targetPath)));

  return allowedPaths.some((allowed) => {
    const normalizedAllowed = normalize(resolve(expandTilde(allowed)));
    return (
      normalizedTarget === normalizedAllowed ||
      normalizedTarget.startsWith(normalizedAllowed + sep)
    );
  });
}

export function validatePath(
  userPath: string,
  allowedPaths: string[],
): { valid: true; resolvedPath: string } | { valid: false; error: string } {
  if (!userPath || userPath.trim() === "") {
    return { valid: false, error: "Path cannot be empty" };
  }

  // Block null bytes
  if (userPath.includes("\0")) {
    return { valid: false, error: "Invalid path: contains null bytes" };
  }

  const resolvedPath = normalizePath("/", userPath);

  if (!isPathAllowed(resolvedPath, allowedPaths)) {
    return {
      valid: false,
      error: `Access denied: path is outside allowed directories`,
    };
  }

  return { valid: true, resolvedPath };
}

/**
 * Normalize whitespace variants (narrow no-break space, non-breaking space, etc.)
 * to regular spaces for fuzzy filename matching.
 */
function normalizeWhitespace(s: string): string {
  return s.replace(/[\u00A0\u202F\u2009\u2008\u2007\u2006\u2005\u2004\u2003\u2002\u200A\uFEFF]/g, " ");
}

/**
 * When an exact path doesn't exist, try to find a matching file in the same
 * directory by normalizing Unicode whitespace variants. This handles the common
 * case where filenames contain narrow no-break spaces (macOS screenshots) but
 * the request uses regular spaces.
 */
function fuzzyResolvePath(resolvedPath: string): string | null {
  const dir = dirname(resolvedPath);
  const target = normalizeWhitespace(basename(resolvedPath));

  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (normalizeWhitespace(entry) === target) {
        return resolve(dir, entry);
      }
    }
  } catch {
    // directory doesn't exist or can't be read
  }
  return null;
}

export function validateAndResolvePath(
  userPath: string,
  allowedPaths: string[],
  mustExist: boolean = false,
): { valid: true; resolvedPath: string } | { valid: false; error: string; status?: number } {
  const result = validatePath(userPath, allowedPaths);

  if (!result.valid) return { ...result, status: 403 };

  if (mustExist && !existsSync(result.resolvedPath)) {
    const fuzzyMatch = fuzzyResolvePath(result.resolvedPath);
    if (fuzzyMatch) {
      return { valid: true, resolvedPath: fuzzyMatch };
    }
    return { valid: false, error: `Path not found: ${userPath}`, status: 404 };
  }

  return result;
}

export function isDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}
