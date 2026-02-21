import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { FileNodeConfig } from "../src/types";
import { createCommandHandler, NODE_COMMANDS } from "../src/node/commands";

const TEST_DIR = join(tmpdir(), "filenode-cmd-test-" + Date.now());

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

describe("Node Command Handlers", () => {
  const config = testConfig();
  const handler = createCommandHandler(config);

  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, "test.txt"), "Hello from commands");
    writeFileSync(join(TEST_DIR, "data.json"), '{"a":1}');
    mkdirSync(join(TEST_DIR, "sub"), { recursive: true });
    writeFileSync(join(TEST_DIR, "sub", "inner.txt"), "inner");
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("should export the correct command list", () => {
    expect(NODE_COMMANDS).toContain("files.list");
    expect(NODE_COMMANDS).toContain("files.read");
    expect(NODE_COMMANDS).toContain("files.write");
    expect(NODE_COMMANDS).toContain("files.append");
    expect(NODE_COMMANDS).toContain("files.delete");
    expect(NODE_COMMANDS).toContain("files.mkdir");
    expect(NODE_COMMANDS).toContain("files.info");
  });

  describe("files.list", () => {
    it("should list a directory", async () => {
      const result = (await handler("files.list", { path: TEST_DIR })) as any;
      expect(result.type).toBe("directory");
      const names = result.contents.map((e: any) => e.name);
      expect(names).toContain("test.txt");
      expect(names).toContain("sub");
    });

    it("should list recursively", async () => {
      const result = (await handler("files.list", {
        path: TEST_DIR,
        recursive: true,
      })) as any;
      const sub = result.contents.find((e: any) => e.name === "sub");
      expect(sub.contents).toBeDefined();
    });
  });

  describe("files.read", () => {
    it("should read a text file", async () => {
      const result = (await handler("files.read", {
        path: join(TEST_DIR, "test.txt"),
      })) as any;
      expect(result.content).toBe("Hello from commands");
      expect(result.encoding).toBe("utf-8");
    });

    it("should read in base64", async () => {
      const result = (await handler("files.read", {
        path: join(TEST_DIR, "test.txt"),
        format: "base64",
      })) as any;
      expect(Buffer.from(result.content, "base64").toString()).toBe(
        "Hello from commands",
      );
    });

    it("should throw for missing path", async () => {
      await expect(handler("files.read", {})).rejects.toThrow("path is required");
    });
  });

  describe("files.write", () => {
    it("should write a file", async () => {
      const path = join(TEST_DIR, "cmd_write.txt");
      const result = (await handler("files.write", {
        path,
        content: "written via command",
      })) as any;
      expect(result.created).toBe(true);
      expect(readFileSync(path, "utf-8")).toBe("written via command");
    });

    it("should throw for missing content", async () => {
      await expect(
        handler("files.write", { path: join(TEST_DIR, "x.txt") }),
      ).rejects.toThrow("content is required");
    });
  });

  describe("files.append", () => {
    it("should append to a file", async () => {
      const path = join(TEST_DIR, "cmd_append.txt");
      writeFileSync(path, "A");
      await handler("files.append", { path, content: "B" });
      expect(readFileSync(path, "utf-8")).toBe("AB");
    });
  });

  describe("files.delete", () => {
    it("should delete a file", async () => {
      const path = join(TEST_DIR, "cmd_del.txt");
      writeFileSync(path, "x");
      await handler("files.delete", { path });
      expect(existsSync(path)).toBe(false);
    });
  });

  describe("files.mkdir", () => {
    it("should create a directory", async () => {
      const path = join(TEST_DIR, "cmd_mkdir");
      const result = (await handler("files.mkdir", { path })) as any;
      expect(result.created).toBe(true);
      expect(existsSync(path)).toBe(true);
    });
  });

  describe("files.info", () => {
    it("should return discovery info", async () => {
      const result = (await handler("files.info", {})) as any;
      expect(result.server).toBe("FileNode");
      expect(result.endpoints).toBeDefined();
    });
  });

  describe("unknown command", () => {
    it("should throw for unknown commands", async () => {
      await expect(handler("files.unknown", {})).rejects.toThrow(
        "Unknown command",
      );
    });
  });
});
