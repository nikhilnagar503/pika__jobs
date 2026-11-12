/**
 * Pure helpers used by feed/jobs/admin store modules.
 */
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { formatPay } from "@/domain/jobs/pay";
import { compareLatest } from "@/domain/jobs/feed";
import type { JobRecord } from "@/domain/types";
import { AppError } from "@/http";
import type { CredentialRecord } from "@/repositories/db";
import type { FeedCursor, JobCard } from "@/repositories/store/types";

export function publicCredential(record: CredentialRecord) {
  return {
    id: record.id,
    name: record.name,
    prefix: record.prefix,
    scopes: record.scopes,
    sourceIds: record.sourceIds,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt,
    lastUsedAt: record.lastUsedAt,
    dailyLimit: record.dailyLimit,
  };
}

export function toCard(job: JobRecord, reasons: string[], saved = false): JobCard {
  const words = job.companyName.split(/\s+/).filter(Boolean);
  const showEmail = Boolean(job.hrEmail && job.hrEmailApproved);
  return {
    id: job.jobId,
    title: job.title,
    companyName: job.companyName,
    companyInitials: ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? "")).toUpperCase(),
    locationLabel: job.locationLabel,
    workMode: job.workMode,
    payLabel: job.payDisplayLabel || formatPay(job),
    opportunityKind: job.opportunityKind,
    sector: job.sector,
    skills: job.skills.slice(0, 4),
    requirements: (job.requirements ?? []).slice(0, 8),
    eligibility: (job.eligibility ?? []).slice(0, 8),
    responsibilities: (job.responsibilities ?? []).slice(0, 8),
    batchLabel: job.batchLabel ?? null,
    durationLabel: job.durationLabel ?? null,
    originalSourceLabel: job.originalSourceLabel ?? null,
    applyNote: job.applyNote ?? null,
    summary: job.summary,
    effectiveJobAt: job.effectiveJobAt,
    publishedAt: job.publishedAt,
    firstSeenAt: job.firstSeenAt,
    datePrecision: job.datePrecision,
    sourcePublishedAt: job.sourcePublishedAt,
    lastCheckedAt: job.lastCheckedAt,
    deadlineAt: job.deadlineAt,
    accessTier: job.accessTier,
    reasons,
    applicationKind: job.applicationMethod,
    applicationUrl: job.applicationMethod === "email" ? null : job.applicationUrl,
    hrEmail: showEmail ? job.hrEmail : null,
    emailSubject: showEmail ? job.emailSubject : null,
    saved,
  };
}

export function compareRanked(a: { job: JobRecord; score: number }, b: { job: JobRecord; score: number }): number {
  if (b.score !== a.score) return b.score - a.score;
  return compareLatest(a.job, b.job);
}

export function afterCursor(item: { job: JobRecord; score: number }, cursor: FeedCursor, sort: "latest" | "for_you"): boolean {
  const pivot = {
    ...item.job,
    jobId: cursor.id,
    publishedAt: cursor.at,
    firstSeenAt: cursor.at,
    effectiveJobAt: cursor.at,
  };
  if (sort === "latest") return compareLatest(item.job, pivot) > 0;
  if (item.score !== cursor.score) return item.score < (cursor.score ?? 0);
  return compareLatest(item.job, pivot) > 0;
}

export function encodeCursor(cursor: FeedCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeCursor(value: string): FeedCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as FeedCursor;
    if (!parsed.at || !parsed.id || !parsed.asOf || (parsed.sort !== "latest" && parsed.sort !== "for_you")) {
      throw new Error("bad");
    }
    return parsed;
  } catch {
    throw new AppError(400, "bad_cursor", "That feed page token is not valid.");
  }
}

export function clientRefOf(raw: unknown): string {
  if (raw && typeof raw === "object" && "client_reference" in raw && typeof raw.client_reference === "string") return raw.client_reference;
  return "unknown";
}

export function encryptSecret(value: string, secret: string): string {
  const iv = randomBytes(12);
  const key = createHash("sha256").update(secret).digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

