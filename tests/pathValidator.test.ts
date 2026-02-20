import { describe, it, expect } from "bun:test";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  expandTilde,
  normalizePath,
  isPathAllowed,
  validatePath,
} from "../src/utils/pathValidator";

describe("pathValidator", () => {
  const home = homedir();

  describe("expandTilde", () => {
    it("should expand ~ to home directory", () => {
      expect(expandTilde("~/Documents")).toBe(join(home, "Documents"));
    });

    it("should return non-tilde paths unchanged", () => {
      expect(expandTilde("/usr/local")).toBe("/usr/local");
    });

    it("should handle bare tilde", () => {
      const result = expandTilde("~");
      expect(result).toBe(resolve(home));
    });
  });

  describe("isPathAllowed", () => {
    const allowedPaths = [
      join(home, "Documents"),
      join(home, "Desktop"),
    ];

    it("should allow paths within allowed directories", () => {
      expect(isPathAllowed(join(home, "Documents", "file.txt"), allowedPaths)).toBe(true);
    });

    it("should allow the exact allowed path", () => {
      expect(isPathAllowed(join(home, "Documents"), allowedPaths)).toBe(true);
    });

    it("should deny paths outside allowed directories", () => {
      expect(isPathAllowed("/etc/passwd", allowedPaths)).toBe(false);
    });

    it("should deny parent directory traversal", () => {
      expect(isPathAllowed(join(home, "Documents", "..", "secret"), allowedPaths)).toBe(false);
    });

    it("should deny home directory root", () => {
      expect(isPathAllowed(home, allowedPaths)).toBe(false);
    });
  });

  describe("validatePath", () => {
    const allowedPaths = [join(home, "Documents")];

    it("should reject empty paths", () => {
      const result = validatePath("", allowedPaths);
      expect(result.valid).toBe(false);
    });

    it("should reject null byte paths", () => {
      const result = validatePath("/test\0/file", allowedPaths);
      expect(result.valid).toBe(false);
    });

    it("should reject paths outside allowed dirs", () => {
      const result = validatePath("/etc/passwd", allowedPaths);
      expect(result.valid).toBe(false);
    });

    it("should accept valid paths within allowed dirs", () => {
      const result = validatePath(
        join(home, "Documents", "test.txt"),
        allowedPaths,
      );
      expect(result.valid).toBe(true);
    });

    it("should prevent path traversal attacks", () => {
      const attacks = [
        join(home, "Documents", "..", "..", "etc", "passwd"),
        join(home, "Documents", "..%2F..%2Fetc%2Fpasswd"),
      ];

      for (const attack of attacks) {
        const result = validatePath(attack, allowedPaths);
        if (result.valid) {
          expect(result.resolvedPath.startsWith(join(home, "Documents"))).toBe(true);
        }
      }
    });
  });
});
