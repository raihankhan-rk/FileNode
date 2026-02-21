import { readdirSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import type { FileNodeConfig, DirectoryEntry } from "../types/index.js";
import { validateAndResolvePath } from "../utils/pathValidator.js";
import type { CoreResult, ListDirParams, ListDirResult } from "./types.js";

export function listDirectory(
  dirPath: string,
  recursive: boolean,
  currentDepth: number,
  maxDepth: number,
): DirectoryEntry[] {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const result: DirectoryEntry[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    const fullPath = join(dirPath, entry.name);

    try {
      const stats = statSync(fullPath);

      if (entry.isDirectory()) {
        const dirEntry: DirectoryEntry = {
          name: entry.name,
          type: "directory",
          modified: stats.mtime.toISOString(),
        };

        if (recursive && currentDepth < maxDepth) {
          dirEntry.contents = listDirectory(
            fullPath,
            recursive,
            currentDepth + 1,
            maxDepth,
          );
        }

        result.push(dirEntry);
      } else if (entry.isFile()) {
        result.push({
          name: entry.name,
          type: "file",
          size: stats.size,
          modified: stats.mtime.toISOString(),
        });
      }
    } catch {
      // Skip entries we can't stat (permission errors, etc.)
    }
  }

  return result.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function listDir(
  params: ListDirParams,
  config: FileNodeConfig,
): CoreResult<ListDirResult> {
  const result = validateAndResolvePath(params.path, config.allowedPaths, true);

  if (!result.valid) {
    return { ok: false, error: result.error, status: result.status ?? 403 };
  }

  const stats = statSync(result.resolvedPath);
  if (!stats.isDirectory()) {
    return { ok: false, error: "Path is not a directory", status: 400 };
  }

  const recursive = params.recursive ?? false;
  const maxDepth = Math.min(params.maxDepth ?? config.maxListDepth, 10);

  const contents = listDirectory(result.resolvedPath, recursive, 0, maxDepth);

  return {
    ok: true,
    data: {
      path: result.resolvedPath,
      type: "directory",
      contents,
    },
  };
}

export function getDiscoveryInfo(config: FileNodeConfig) {
  const displayPaths = config.allowedPaths.includes("/")
    ? [homedir()]
    : config.allowedPaths;

  const roots = displayPaths
    .filter((p) => existsSync(p))
    .map((dirPath) => {
      const contents = listDirectory(dirPath, false, 0, 1);
      return {
        path: dirPath,
        name: basename(dirPath) || dirPath,
        type: "directory" as const,
        contents,
      };
    });

  return {
    server: "FileNode",
    version: config.version,
    description:
      "FileNode is a local file server running on the user's machine. It exposes the local filesystem as a REST API so you can browse directories, read files, write files, append to files, create directories, and delete files — all over HTTP. Below you'll find the available API endpoints and the directories you can access.",
    endpoints: {
      "GET /":
        "You are here. Returns this description, API usage guide, and all accessible directories with their top-level contents.",
      "GET /health": "Server health check.",
      "GET /list/<path>": {
        description: "List contents of a directory.",
        queryParams: {
          recursive:
            "Set to 'true' to include subdirectory contents (default: false)",
          maxDepth:
            "How many levels deep to recurse (default: 3, max: 10)",
        },
        example: "GET /list/Users/john/Documents?recursive=true&maxDepth=2",
      },
      "GET /files/<path>": {
        description:
          "Read a file's contents. Returns text for text files, raw bytes for binary files.",
        queryParams: {
          format:
            "'text', 'json', or 'base64' (default: auto-detect from file extension)",
          lines:
            "Return only the first N lines (useful for previewing large files)",
          path: "Alternative to putting the path in the URL. Preferred for filenames with spaces or special characters. Example: GET /files?path=/Users/john/Desktop/my file.txt",
        },
        example: "GET /files/Users/john/Documents/notes.txt",
      },
      "POST /files/<path>": {
        description:
          "Write or overwrite a file. Creates parent directories automatically.",
        body: '{ "content": "file contents here", "encoding": "utf-8" }',
        example: "POST /files/Users/john/Documents/new.txt",
      },
      "POST /append/<path>": {
        description:
          "Append content to a file. Creates the file if it doesn't exist.",
        body: '{ "content": "text to append" }',
        example: "POST /append/Users/john/Documents/log.txt",
      },
      "DELETE /files/<path>": {
        description: "Delete a file or directory.",
        queryParams: {
          recursive: "Must be 'true' to delete a non-empty directory",
        },
        example: "DELETE /files/Users/john/Documents/old.txt",
      },
      "POST /mkdir/<path>": {
        description:
          "Create a directory, including any missing parent directories.",
        example: "POST /mkdir/Users/john/Documents/new/folder",
      },
    },
    tips: [
      "No authentication required — all endpoints are open.",
      "For filenames with spaces or special characters, use the ?path= query parameter instead of encoding them in the URL. Example: GET /files?path=/Users/john/Desktop/Screenshot 2026-02-20 at 6.33.06 PM.png",
      "The ?path= query parameter works on ALL endpoints (list, files, append, mkdir, delete).",
      "Paths in the URL should be absolute paths without a leading slash, e.g. /files/Users/john/Documents/file.txt",
      "Use GET / (this endpoint) first to discover what directories are available before trying to access files.",
    ],
    allowedPaths: roots,
  };
}
