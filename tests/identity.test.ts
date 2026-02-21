import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, homedir } from "node:os";

const NODE_JSON = join(homedir(), ".filenode", "node.json");

function removeNodeJson() {
  try { rmSync(NODE_JSON); } catch {}
}

let savedNodeJson: string | null = null;

describe("Node Identity", () => {
  beforeAll(() => {
    try {
      const { readFileSync } = require("node:fs");
      savedNodeJson = readFileSync(NODE_JSON, "utf-8");
    } catch {
      savedNodeJson = null;
    }
    removeNodeJson();
  });

  afterAll(() => {
    if (savedNodeJson !== null) {
      mkdirSync(join(homedir(), ".filenode"), { recursive: true });
      writeFileSync(NODE_JSON, savedNodeJson, { mode: 0o600 });
    } else {
      removeNodeJson();
    }
  });

  it("should generate a device identity with all required fields", () => {
    removeNodeJson();
    const { loadNodeIdentity } = require("../src/node/identity");
    const identity = loadNodeIdentity();

    expect(identity.deviceId).toBeDefined();
    expect(typeof identity.deviceId).toBe("string");
    expect(identity.deviceId.length).toBeGreaterThan(0);

    expect(identity.publicKey).toContain("PUBLIC KEY");
    expect(identity.privateKey).toContain("PRIVATE KEY");
    expect(identity.deviceToken).toBe("");
  });

  it("should persist and reload the same identity", () => {
    const { loadNodeIdentity } = require("../src/node/identity");
    const first = loadNodeIdentity();
    const second = loadNodeIdentity();

    expect(second.deviceId).toBe(first.deviceId);
    expect(second.publicKey).toBe(first.publicKey);
    expect(second.privateKey).toBe(first.privateKey);
  });

  it("should save and restore deviceToken", () => {
    const { loadNodeIdentity, saveNodeIdentity } = require("../src/node/identity");
    const identity = loadNodeIdentity();
    identity.deviceToken = "test-token-abc";
    saveNodeIdentity(identity);

    const reloaded = loadNodeIdentity();
    expect(reloaded.deviceToken).toBe("test-token-abc");
  });

  it("should produce valid signatures for nonces", () => {
    const { loadNodeIdentity, signNonce } = require("../src/node/identity");
    const identity = loadNodeIdentity();

    const nonce = "test-nonce-12345";
    const signature = signNonce(nonce, identity.privateKey);

    expect(typeof signature).toBe("string");
    expect(signature.length).toBeGreaterThan(0);

    const { verify, createPublicKey } = require("node:crypto");
    const pubKey = createPublicKey(identity.publicKey);
    const isValid = verify(
      null,
      Buffer.from(nonce),
      pubKey,
      Buffer.from(signature, "base64"),
    );
    expect(isValid).toBe(true);
  });
});
