import { randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_PREFIX = "fnk_";
const TOKEN_BYTES = 32;

export function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(TOKEN_BYTES).toString("hex");
}

export function validateToken(provided: string, stored: string): boolean {
  if (!provided || !stored) return false;
  if (!provided.startsWith(TOKEN_PREFIX) || !stored.startsWith(TOKEN_PREFIX))
    return false;

  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(stored);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
