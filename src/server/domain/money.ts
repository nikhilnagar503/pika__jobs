import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function referralCode(bytes = randomBytes(10)): string {
  let code = "";
  for (let index = 0; index < 10; index += 1) {
    code += CODE_ALPHABET[bytes[index] % CODE_ALPHABET.length];
  }
  return code;
}

export function commissionMinor(eligibleMinor: number, rateBps: number): number {
  if (eligibleMinor <= 0 || rateBps <= 0) return 0;
  return Math.round((eligibleMinor * rateBps) / 10_000);
}

export function entitlementWindow(input: {
  existingEnds: Date[];
  purchaseAt: Date;
  days: number;
}): { startsAt: Date; endsAt: Date } {
  const futureEnds = input.existingEnds.filter((end) => end.getTime() > input.purchaseAt.getTime());
  const startMs = Math.max(input.purchaseAt.getTime(), ...futureEnds.map((end) => end.getTime()));
  const startsAt = new Date(startMs);
  const endsAt = new Date(startMs + input.days * 24 * 60 * 60 * 1000);
  return { startsAt, endsAt };
}

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

export function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function checkoutSignature(orderId: string, paymentId: string, secret: string): string {
  return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

export function webhookSignature(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function fingerprint(parts: string[]): string {
  return createHmac("sha256", "pikajobs-fingerprint").update(parts.map((part) => part.trim().toLowerCase()).join("|")).digest("hex");
}
