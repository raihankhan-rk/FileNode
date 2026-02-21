import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { FileNodeConfig } from "../src/types";
import { listDir, getDiscoveryInfo } from "../src/core/listDir";
import { readFileCore } from "../src/core/readFile";
import { writeFileCore } from "../src/core/writeFile";
import { appendFileCore } from "../src/core/appendFile";
import { deleteFileCore } from "../src/core/deleteFile";
import { mkdirCore } from "../src/core/mkdir";

const TEST_DIR = join(tmpdir(), "filenode-core-test-" + Date.now());

function testConfig(): FileNodeConfig {
  return {
    version: "0.1.0",
    port: 0,
    host: "localhost",
    allowedPaths: [TEST_DIR],
    maxFileSize: "10MB",
    maxListDepth: 3,
    rateLimitPerMin: 1000,
    enableLogging: false,
    logLevel: "silent",
    enableCORS: false,
    corsOrigins: [],
    enableHTTPS: false,
    certPath: null,
    keyPath: null,
    gateway: null,
    displayName: "FileNode",
  };
}

describe("Core Functions", () => {
  const config = testConfig();

  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, "hello.txt"), "Hello World");
    writeFileSync(join(TEST_DIR, "data.json"), JSON.stringify({ key: "value" }));
    mkdirSync(join(TEST_DIR, "subdir"), { recursive: true });
    writeFileSync(join(TEST_DIR, "subdir", "nested.txt"), "Nested content");
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("listDir", () => {
    it("should list directory contents", () => {
      const result = listDir({ path: TEST_DIR }, config);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.type).toBe("directory");
      const names = result.data.contents.map((e) => e.name);
      expect(names).toContain("hello.txt");
      expect(names).toContain("subdir");
    });

    it("should list recursively", () => {
      const result = listDir({ path: TEST_DIR, recursive: true, maxDepth: 3 }, config);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const subdir = result.data.contents.find((e) => e.name === "subdir");
      expect(subdir?.contents).toBeDefined();
      expect(subdir!.contents!.length).toBeGreaterThan(0);
    });

    it("should reject non-directory paths", () => {
      const result = listDir({ path: join(TEST_DIR, "hello.txt") }, config);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(400);
    });

    it("should reject paths outside allowed dirs", () => {
      const result = listDir({ path: "/etc" }, config);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(403);
    });
  });

  describe("readFileCore", () => {
    it("should read text files", () => {
      const result = readFileCore({ path: join(TEST_DIR, "hello.txt") }, config);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.content).toBe("Hello World");
      expect(result.data.isText).toBe(true);
    });

    it("should read in base64 format", () => {
      const result = readFileCore({ path: join(TEST_DIR, "hello.txt"), format: "base64" }, config);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(Buffer.from(result.data.content as string, "base64").toString()).toBe("Hello World");
    });

    it("should limit lines", () => {
      writeFileSync(join(TEST_DIR, "multiline.txt"), "a\nb\nc\nd\ne");
      const result = readFileCore({ path: join(TEST_DIR, "multiline.txt"), lines: 2 }, config);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.content).toBe("a\nb");
    });

    it("should reject directory paths", () => {
      const result = readFileCore({ path: TEST_DIR }, config);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(400);
    });

    it("should return 404 for non-existent files", () => {
      const result = readFileCore({ path: join(TEST_DIR, "nope.txt") }, config);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(404);
    });
  });

  describe("writeFileCore", () => {
    it("should create new files", () => {
      const path = join(TEST_DIR, "core_new.txt");
      const result = writeFileCore({ path, content: "hello" }, config);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.created).toBe(true);
      expect(readFileSync(path, "utf-8")).toBe("hello");
    });

    it("should overwrite existing files", () => {
      const path = join(TEST_DIR, "core_new.txt");
      const result = writeFileCore({ path, content: "updated" }, config);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.created).toBe(false);
    });

    it("should reject paths outside allowed dirs", () => {
      const result = writeFileCore({ path: "/tmp/evil.txt", content: "bad" }, config);
      expect(result.ok).toBe(false);
    });
  });

  describe("appendFileCore", () => {
    it("should append to files", () => {
      const path = join(TEST_DIR, "core_append.txt");
      writeFileSync(path, "Start");
      const result = appendFileCore({ path, content: " End" }, config);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.appended).toBe(true);
      expect(readFileSync(path, "utf-8")).toBe("Start End");
    });
  });

  describe("deleteFileCore", () => {
    it("should delete files", () => {
      const path = join(TEST_DIR, "core_delete.txt");
      writeFileSync(path, "delete me");
      const result = deleteFileCore({ path }, config);
      expect(result.ok).toBe(true);
      expect(existsSync(path)).toBe(false);
    });

    it("should require recursive for directories", () => {
      const dir = join(TEST_DIR, "core_deldir");
      mkdirSync(dir, { recursive: true });
      const result = deleteFileCore({ path: dir }, config);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(400);
    });

    it("should delete directories recursively", () => {
      const dir = join(TEST_DIR, "core_deldir");
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "inner.txt"), "x");
      const result = deleteFileCore({ path: dir, recursive: true }, config);
      expect(result.ok).toBe(true);
      expect(existsSync(dir)).toBe(false);
    });
  });

  describe("mkdirCore", () => {
    it("should create directories", () => {
      const path = join(TEST_DIR, "core_mkdir_test");
      const result = mkdirCore({ path }, config);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.created).toBe(true);
      expect(existsSync(path)).toBe(true);
    });

    it("should reject existing paths", () => {
      const result = mkdirCore({ path: join(TEST_DIR, "subdir") }, config);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.status).toBe(409);
    });
  });

  describe("getDiscoveryInfo", () => {
    it("should return server info", () => {
      const info = getDiscoveryInfo(config);
      expect(info.server).toBe("FileNode");
      expect(info.version).toBe("0.1.0");
      expect(info.endpoints).toBeDefined();
      expect(info.allowedPaths).toBeDefined();
      expect(Array.isArray(info.allowedPaths)).toBe(true);
    });
  });
});
