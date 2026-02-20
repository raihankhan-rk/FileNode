import { describe, it, expect } from "bun:test";
import { generateToken, validateToken } from "../src/utils/crypto";

describe("crypto", () => {
  describe("generateToken", () => {
    it("should generate a token with fnk_ prefix", () => {
      const token = generateToken();
      expect(token.startsWith("fnk_")).toBe(true);
    });

    it("should generate a 68-character token (4 prefix + 64 hex)", () => {
      const token = generateToken();
      expect(token.length).toBe(68);
    });

    it("should generate unique tokens", () => {
      const tokens = new Set(Array.from({ length: 100 }, () => generateToken()));
      expect(tokens.size).toBe(100);
    });

    it("should only contain hex characters after prefix", () => {
      const token = generateToken();
      const hex = token.slice(4);
      expect(/^[0-9a-f]+$/.test(hex)).toBe(true);
    });
  });

  describe("validateToken", () => {
    it("should validate matching tokens", () => {
      const token = generateToken();
      expect(validateToken(token, token)).toBe(true);
    });

    it("should reject mismatched tokens", () => {
      const a = generateToken();
      const b = generateToken();
      expect(validateToken(a, b)).toBe(false);
    });

    it("should reject empty strings", () => {
      expect(validateToken("", "")).toBe(false);
      expect(validateToken("", generateToken())).toBe(false);
      expect(validateToken(generateToken(), "")).toBe(false);
    });

    it("should reject tokens without fnk_ prefix", () => {
      expect(validateToken("invalid_token", "invalid_token")).toBe(false);
    });

    it("should reject tokens of different lengths", () => {
      const token = generateToken();
      expect(validateToken(token, token + "a")).toBe(false);
    });
  });
});
