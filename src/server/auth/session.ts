import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import type { Actor } from "@/server/domain/types";
import type { MemoryStore } from "@/server/repositories/memory";

const COOKIE = "pikajobs_session";
const WEEK = 60 * 60 * 24 * 14;
let memorySecret: string | null = null;

function dataDir(): string {
  return process.env.VERCEL ? path.join("/tmp", "pikajobs-data") : path.join(process.cwd(), ".data");
}

function sessionSecret(): string {
  if (process.env.PIKAJOBS_SESSION_SECRET && process.env.PIKAJOBS_SESSION_SECRET.length >= 16) {
    return process.env.PIKAJOBS_SESSION_SECRET;
  }
  const file = path.join(dataDir(), "session.secret");
  try {
    if (existsSync(file)) return readFileSync(file, "utf8").trim();
    const created = randomBytes(32).toString("hex");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, created, { mode: 0o600 });
    return created;
  } catch {
    // Vercel/serverless filesystems can be read-only. Prefer setting PIKAJOBS_SESSION_SECRET.
    memorySecret ??= randomBytes(32).toString("hex");
    return memorySecret;
  }
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function sealSession(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + WEEK * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function openSession(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId?: string; exp?: number };
    if (!parsed.userId || !parsed.exp || parsed.exp < Date.now()) return null;
    return parsed.userId;
  } catch {
    return null;
  }
}

export async function readActor(store: MemoryStore): Promise<Actor> {
  const jar = await cookies();
  const userId = openSession(jar.get(COOKIE)?.value);
  if (!userId) return { kind: "anonymous" };
  return store.actorFor(userId);
}

export async function writeSession(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE, sealSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: WEEK,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function referralCookie(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get("pikajobs_ref")?.value ?? null;
  return value && /^[A-Z2-9]{10}$/.test(value) ? value : null;
}

export { COOKIE };
