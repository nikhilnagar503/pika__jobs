import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateAgentToken(): { token: string; digest: string; prefix: string } {
  const token = `pkj_${randomBytes(32).toString("base64url")}`;
  return { token, digest: hashToken(token), prefix: token.slice(0, 12) };
}

export function tokenMatches(token: string, digest: string): boolean {
  const actual = Buffer.from(hashToken(token), "hex");
  const expected = Buffer.from(digest, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function fingerprint(parts: string[]): string {
  return createHmac("sha256", "pikajobs-fingerprint")
    .update(parts.map((part) => part.trim().toLowerCase()).join("|"))
    .digest("hex");
}
