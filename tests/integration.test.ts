import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { createApp } from "../src/server";
import { generateToken } from "../src/utils/crypto";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { FileNodeConfig } from "../src/types";

const TEST_DIR = join(tmpdir(), "filenode-test-" + Date.now());
const TEST_TOKEN = generateToken();

function defaultTestConfig(): FileNodeConfig {
  return {
    version: "0.1.0",
    port: 0,
    host: "localhost",
    token: TEST_TOKEN,
    allowedPaths: [TEST_DIR],
    maxFileSize: "10MB",
    maxListDepth: 3,
    rateLimitPerMin: 1000,
    enableLogging: false,
    logLevel: "silent",
    enableCORS: true,
    corsOrigins: ["*"],
    enableHTTPS: false,
    certPath: null,
    keyPath: null,
  };
}

const config = defaultTestConfig();
const { app } = createApp(config);

function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${TEST_TOKEN}`);
  }
  return app.request(path, { ...options, headers });
}

describe("Integration Tests", () => {
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

  describe("GET /health", () => {
    it("should return health status without auth", async () => {
      const res = await app.request("/health");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("healthy");
      expect(body.version).toBe("0.1.0");
      expect(typeof body.uptime).toBe("number");
    });
  });

  describe("Authentication", () => {
    it("should reject requests without auth header", async () => {
      const res = await app.request("/list/" + encodeURIComponent(TEST_DIR));
      expect(res.status).toBe(401);
    });

    it("should reject invalid tokens", async () => {
      const res = await app.request("/list/" + encodeURIComponent(TEST_DIR), {
        headers: { Authorization: "Bearer fnk_invalidtoken" },
      });
      expect(res.status).toBe(403);
    });

    it("should reject malformed auth headers", async () => {
      const res = await app.request("/list/" + encodeURIComponent(TEST_DIR), {
        headers: { Authorization: "Basic abc123" },
      });
      expect(res.status).toBe(401);
    });
  });

  describe("GET /list/:path", () => {
    it("should list directory contents", async () => {
      const res = await request("/list" + TEST_DIR);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.type).toBe("directory");
      expect(Array.isArray(body.contents)).toBe(true);

      const names = body.contents.map((e: any) => e.name);
      expect(names).toContain("hello.txt");
      expect(names).toContain("data.json");
      expect(names).toContain("subdir");
    });

    it("should list recursively with flag", async () => {
      const res = await request("/list" + TEST_DIR + "?recursive=true");
      expect(res.status).toBe(200);

      const body = await res.json();
      const subdir = body.contents.find((e: any) => e.name === "subdir");
      expect(subdir).toBeDefined();
      expect(subdir.contents).toBeDefined();
      expect(subdir.contents.length).toBeGreaterThan(0);
    });

    it("should reject non-directory paths", async () => {
      const res = await request("/list" + join(TEST_DIR, "hello.txt"));
      expect(res.status).toBe(400);
    });
  });

  describe("GET /files/:path", () => {
    it("should read text files", async () => {
      const res = await request("/files" + join(TEST_DIR, "hello.txt"));
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("Hello World");
    });

    it("should read JSON files as JSON", async () => {
      const res = await request(
        "/files" + join(TEST_DIR, "data.json") + "?format=json",
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.key).toBe("value");
    });

    it("should support lines parameter", async () => {
      writeFileSync(
        join(TEST_DIR, "multiline.txt"),
        "line1\nline2\nline3\nline4\nline5",
      );
      const res = await request(
        "/files" + join(TEST_DIR, "multiline.txt") + "?lines=2",
      );
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("line1\nline2");
    });

    it("should support base64 format", async () => {
      const res = await request(
        "/files" + join(TEST_DIR, "hello.txt") + "?format=base64",
      );
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(Buffer.from(text, "base64").toString()).toBe("Hello World");
    });

    it("should reject directory paths", async () => {
      const res = await request("/files" + TEST_DIR);
      expect(res.status).toBe(400);
    });

    it("should return 404 for non-existent files", async () => {
      const res = await request("/files" + join(TEST_DIR, "nonexistent.txt"));
      expect(res.status).toBe(404);
    });
  });

  describe("POST /files/:path", () => {
    it("should create new files", async () => {
      const res = await request("/files" + join(TEST_DIR, "new.txt"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "New file content" }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.created).toBe(true);
      expect(body.size).toBeGreaterThan(0);
    });

    it("should overwrite existing files", async () => {
      const res = await request("/files" + join(TEST_DIR, "new.txt"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Updated content" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.created).toBe(false);
    });

    it("should reject missing content field", async () => {
      const res = await request("/files" + join(TEST_DIR, "bad.txt"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: "wrong field" }),
      });
      expect(res.status).toBe(400);
    });

    it("should reject invalid JSON", async () => {
      const res = await request("/files" + join(TEST_DIR, "bad.txt"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /append/:path", () => {
    it("should append to existing files", async () => {
      writeFileSync(join(TEST_DIR, "append.txt"), "Start");
      const res = await request("/append" + join(TEST_DIR, "append.txt"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: " End" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.appended).toBe(true);
      expect(body.newSize).toBe(9); // "Start End"
    });

    it("should create file if it doesn't exist", async () => {
      const res = await request(
        "/append" + join(TEST_DIR, "append_new.txt"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "Created" }),
        },
      );
      expect(res.status).toBe(200);
      expect(existsSync(join(TEST_DIR, "append_new.txt"))).toBe(true);
    });
  });

  describe("POST /mkdir/:path", () => {
    it("should create new directories", async () => {
      const res = await request(
        "/mkdir" + join(TEST_DIR, "newdir"),
        { method: "POST" },
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.created).toBe(true);
      expect(existsSync(join(TEST_DIR, "newdir"))).toBe(true);
    });

    it("should create nested directories", async () => {
      const res = await request(
        "/mkdir" + join(TEST_DIR, "a", "b", "c"),
        { method: "POST" },
      );
      expect(res.status).toBe(201);
      expect(existsSync(join(TEST_DIR, "a", "b", "c"))).toBe(true);
    });

    it("should reject already existing paths", async () => {
      const res = await request(
        "/mkdir" + join(TEST_DIR, "subdir"),
        { method: "POST" },
      );
      expect(res.status).toBe(409);
    });
  });

  describe("DELETE /files/:path", () => {
    it("should delete files", async () => {
      writeFileSync(join(TEST_DIR, "to_delete.txt"), "delete me");
      const res = await request(
        "/files" + join(TEST_DIR, "to_delete.txt"),
        { method: "DELETE" },
      );
      expect(res.status).toBe(204);
      expect(existsSync(join(TEST_DIR, "to_delete.txt"))).toBe(false);
    });

    it("should reject directory deletion without recursive flag", async () => {
      mkdirSync(join(TEST_DIR, "dir_to_delete"), { recursive: true });
      const res = await request(
        "/files" + join(TEST_DIR, "dir_to_delete"),
        { method: "DELETE" },
      );
      expect(res.status).toBe(400);
    });

    it("should delete directories with recursive flag", async () => {
      mkdirSync(join(TEST_DIR, "dir_recursive"), { recursive: true });
      writeFileSync(join(TEST_DIR, "dir_recursive", "file.txt"), "inner");

      const res = await request(
        "/files" + join(TEST_DIR, "dir_recursive") + "?recursive=true",
        { method: "DELETE" },
      );
      expect(res.status).toBe(204);
      expect(existsSync(join(TEST_DIR, "dir_recursive"))).toBe(false);
    });
  });

  describe("Security", () => {
    it("should block path traversal attempts", async () => {
      const attacks = [
        "/files/../../../etc/passwd",
        "/files/..%2F..%2F..%2Fetc%2Fpasswd",
        "/list/../../../etc",
      ];

      for (const path of attacks) {
        const res = await request(path);
        expect([403, 404]).toContain(res.status);
      }
    });

    it("should include security headers", async () => {
      const res = await app.request("/health");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    });

    it("should block access to paths outside allowed dirs", async () => {
      const res = await request("/files/etc/passwd");
      expect(res.status).toBe(403);
    });
  });

  describe("404 Handling", () => {
    it("should return helpful 404 for unknown routes", async () => {
      const res = await request("/unknown");
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.availableEndpoints).toBeDefined();
    });
  });
});
