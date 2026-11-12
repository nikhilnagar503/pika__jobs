import { createHash } from "node:crypto";
import type { JobRecord, Preferences, UserAccount } from "@/domain/types";

/** Where a job listing came from (employer board, manual admin, etc.). */
export type SourceRecord = {
  id: string;
  name: string;
  type: string;
  canonicalDomain: string;
  permissionBasis: string;
  enabled: boolean;
  boardId: string;
  lastSuccessAt: string | null;
};

/** API token for agent / scraper intake. */
export type CredentialRecord = {
  id: string;
  name: string;
  ownerId: string;
  prefix: string;
  digest: string;
  scopes: string[];
  sourceIds: string[];
  expiresAt: string;
  revokedAt: string | null;
  dailyLimit: number;
  usedToday: number;
  usedOn: string;
  lastUsedAt: string | null;
};

/** One bulk job-upload request. */
export type BatchRecord = {
  id: string;
  credentialId: string | null;
  actorUserId: string | null;
  idempotencyKey: string;
  bodyHash: string;
  dryRun: boolean;
  receivedAt: string;
  result: BatchResult;
};

export type BatchItemResult = {
  clientReference: string;
  outcome: "accepted_for_review" | "duplicate" | "rejected" | "needs_review" | "updated";
  jobId?: string;
  errors?: string[];
};

export type BatchResult = {
  batchId: string;
  items: BatchItemResult[];
};

/**
 * App database (file/memory).
 * Live product tables only — payments, ads, and referrals removed until needed.
 */
export type Database = {
  users: UserAccount[];
  preferences: Preferences[];
  companies: { id: string; normalizedName: string; displayName: string }[];
  sources: SourceRecord[];
  drafts: JobRecord[];
  jobsCurrent: JobRecord[];
  jobsArchive: JobRecord[];
  versions: { jobId: string; version: number; summary: string; actorId: string; at: string }[];
  credentials: CredentialRecord[];
  batches: BatchRecord[];
  saved: { userId: string; jobId: string; createdAt: string }[];
  applications: { id: string; userId: string; jobId: string; kind: "opened" | "applied"; occurredAt: string }[];
  audit: { id: string; actorId: string; action: string; objectId: string; at: string; summary: string }[];
  flags: Record<string, boolean>;
  demoSeedVersion: string;
  bootstrapConsumed: boolean;
};

export function createDatabase(): Database {
  return {
    users: [],
    preferences: [],
    companies: [],
    sources: [],
    drafts: [],
    jobsCurrent: [],
    jobsArchive: [],
    versions: [],
    credentials: [],
    batches: [],
    saved: [],
    applications: [],
    audit: [],
    flags: {
      publication_paused: false,
    },
    demoSeedVersion: "",
    bootstrapConsumed: false,
  };
}

export function bodyHash(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stable(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function audit(db: Database, actorId: string, action: string, objectId: string, summary: string, at: string) {
  db.audit.push({ id: crypto.randomUUID(), actorId, action, objectId, at, summary });
}

export function emptyPreferences(userId: string, now: string): Preferences {
  return {
    userId,
    opportunityKinds: [],
    sectors: [],
    roleFamilySlugs: [],
    skillSlugs: [],
    workModes: [],
    locationLabel: "",
    countryCode: "IN",
    experienceBand: "",
    stage: "",
    showUnknownPay: true,
    jobPayTargetMinor: null,
    internshipPayTargetMinor: null,
    otherRoleNote: "",
    updatedAt: now,
  };
}
