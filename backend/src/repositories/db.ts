import { createHash } from "node:crypto";
import { product } from "@/shared/product";
import type { JobRecord, Preferences, UserAccount } from "@/domain/types";

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

export type OrderRecord = {
  id: string;
  userId: string;
  planId: string;
  productMinor: number;
  taxMinor: number;
  currency: string;
  days: number;
  commissionable: boolean;
  rateBps: number;
  referrerUserId: string | null;
  providerOrderId: string | null;
  state: "pending" | "uncertain" | "paid" | "failed" | "refunded";
  createdAt: string;
  refundedProductMinor: number;
};

export type EntitlementRecord = {
  id: string;
  userId: string;
  orderId: string;
  startsAt: string;
  endsAt: string;
  state: "active" | "revoked";
};

export type CreditRecord = {
  id: string;
  economicKey: string;
  referrerUserId: string;
  referredUserId: string;
  orderId: string;
  paymentId: string;
  currency: string;
  amountMinor: number;
  reversedMinor: number;
  reservedMinor: number;
  paidMinor: number;
  availableAt: string;
  frozen: boolean;
  createdAt: string;
};

export type PayoutRecord = {
  id: string;
  userId: string;
  currency: string;
  amountMinor: number;
  status: "requested" | "under_review" | "approved" | "processing" | "unknown" | "paid" | "failed" | "rejected" | "reversed";
  allocations: { creditId: string; amountMinor: number }[];
  beneficiaryMasked: string;
  evidence: { reference: string; amountMinor: number; settledAt: string } | null;
  createdAt: string;
};

export type CampaignRecord = {
  id: string;
  name: string;
  destinationUrl: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
};

export type PaymentEventRecord = {
  providerEventId: string;
  type: string;
  orderId: string;
  providerPaymentId: string;
  createdAt: string;
};

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
  reports: { id: string; userId: string; jobId: string; reason: string; detail: string; state: string; createdAt: string }[];
  orders: OrderRecord[];
  entitlements: EntitlementRecord[];
  credits: CreditRecord[];
  payouts: PayoutRecord[];
  campaigns: CampaignRecord[];
  events: PaymentEventRecord[];
  refundIds: string[];
  attributions: { referredUserId: string; referrerUserId: string; code: string; linkedAt: string }[];
  touches: { cookieId: string; code: string; capturedAt: string }[];
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
    reports: [],
    orders: [],
    entitlements: [],
    credits: [],
    payouts: [],
    campaigns: [],
    events: [],
    refundIds: [],
    attributions: [],
    touches: [],
    audit: [],
    flags: {
      payments_enabled: false,
      ads_enabled: false,
      referrals_enabled: true,
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

export function proUntil(db: Database, userId: string): string | null {
  const ends = db.entitlements
    .filter((item) => item.userId === userId && item.state === "active")
    .map((item) => item.endsAt)
    .sort();
  return ends.at(-1) ?? null;
}

export function balances(credits: CreditRecord[], now: Date) {
  let pending = 0;
  let available = 0;
  let reserved = 0;
  let paid = 0;
  for (const credit of credits) {
    const net = credit.amountMinor - credit.reversedMinor;
    const open = net - credit.reservedMinor - credit.paidMinor;
    reserved += credit.reservedMinor;
    paid += credit.paidMinor;
    if (credit.frozen || new Date(credit.availableAt).getTime() > now.getTime()) pending += open;
    else available += open;
  }
  return { pending, available, reserved, paid, earnedNet: pending + available + reserved + paid };
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

export const defaultPlan = {
  id: "pro-pass-30",
  sku: "pro-pass-30",
  priceMinor: product.draftPriceMinor,
  currency: product.currency,
  days: product.proPassDays,
  commissionable: true,
};
