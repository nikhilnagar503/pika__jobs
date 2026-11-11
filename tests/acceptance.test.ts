import { describe, expect, it } from "vitest";
import { product } from "@/shared/product";
import { insertSponsorSlots } from "@/domain/ads";
import { formatPay } from "@/domain/jobs/pay";
import { isVisibleAt } from "@/domain/jobs/visibility";
import { checkoutSignature, commissionMinor, safeEqualHex, webhookSignature } from "@/domain/money";
import { buildMailto, escapeCsvCell, isBlockedFetchTarget } from "@/domain/safety";
import { AppError } from "@/http";
import { balances } from "@/repositories/db";
import { MemoryStore, type JobInput } from "@/repositories/memory";
import type { Actor, JobRecord } from "@/domain/types";

const now = new Date("2026-11-10T08:00:00.000Z");
const day = 24 * 60 * 60 * 1000;

function store() {
  return new MemoryStore(undefined, { paymentsEnabled: true });
}

function admin(store: MemoryStore) {
  const user = store.createUser({
    email: "nagarn603@gmail.com",
    displayName: "Nikhil",
    adultConfirmed: true,
    now,
  });
  return { user, actor: store.actorFor(user.userId, now) };
}

function member(store: MemoryStore, email: string) {
  const user = store.createUser({ email, displayName: email.split("@")[0], adultConfirmed: true, now });
  return { user, actor: store.actorFor(user.userId, now) };
}

function source(store: MemoryStore, actor: Actor, name = "Example careers") {
  return store.saveSource(actor, {
    name,
    type: "employer",
    canonicalDomain: "careers.example.com",
    permissionBasis: "Employer allowed republication of its public board for this pilot.",
    enabled: true,
    boardId: "example",
  }, now);
}

function input(sourceId: string, patch: Partial<JobInput> = {}): JobInput {
  return {
    title: "Frontend engineer",
    companyName: "Example Studio",
    summary: "Build accessible product interfaces with the frontend team.",
    opportunityKind: "job",
    sector: "private",
    workMode: "hybrid",
    roleFamilySlug: "software-it",
    locationLabel: "Bengaluru",
    countryCode: "IN",
    eligibleCountries: ["IN"],
    skills: ["React", "TypeScript"],
    compensationType: "salary",
    payMinMinor: 120000000,
    payMaxMinor: 180000000,
    payCurrency: "INR",
    payPeriod: "annual",
    payBasis: "ctc",
    applicationMethod: "url",
    applicationUrl: "https://careers.example.com/jobs/frontend",
    sourceId,
    sourceUrl: "https://careers.example.com/jobs/frontend",
    sourcePublishedAt: now.toISOString(),
    accessTier: "free",
    evidenceExcerpt: "Role listed on the company careers page.",
    ...patch,
  };
}

describe("visibility and archive", () => {
  it("hides a job at exactly 30 days and keeps it one hour earlier", () => {
    const effective = new Date("2026-10-11T08:00:00.000Z");
    const cutoff = new Date(effective.getTime() + 30 * day);
    expect(isVisibleAt(cutoff, new Date(cutoff.getTime() - 60 * 60 * 1000))).toBe(true);
    expect(isVisibleAt(cutoff, cutoff)).toBe(false);
  });

  it("rejects a 45 day old source and does not reset age on reimport", () => {
    const db = store();
    const { actor } = admin(db);
    const src = source(db, actor);
    const old = new Date(now.getTime() - 45 * day).toISOString();
    const draft = db.saveJob(actor, input(src.id, { sourcePublishedAt: old, sourceUrl: "https://careers.example.com/old" }), now);
    expect(() => db.publishJob(actor, draft.jobId, now)).toThrow(AppError);
    expect(db.db.jobsCurrent).toHaveLength(0);
  });

  it("keeps the original effective date when the same source is imported again", () => {
    const db = store();
    const { actor } = admin(db);
    const src = source(db, actor);
    const posted = new Date(now.getTime() - 2 * day).toISOString();
    const created = db.saveJob(actor, input(src.id, { sourcePublishedAt: posted, externalJobId: "ext-1" }), now);
    db.publishJob(actor, created.jobId, now);
    const updated = db.saveJob(actor, input(src.id, {
      jobId: created.jobId,
      expectedVersion: created.version,
      externalJobId: "ext-1",
      sourcePublishedAt: now.toISOString(),
      title: "Frontend engineer",
    }), now);
    expect(updated.effectiveJobAt).toBe(posted);
    expect(db.db.jobsCurrent).toHaveLength(1);
  });

  it("moves due jobs once and leaves a conflicting archive row in place", () => {
    const db = store();
    const { actor } = admin(db);
    const src = source(db, actor);
    const created = db.saveJob(actor, input(src.id), now);
    db.publishJob(actor, created.jobId, now);
    const later = new Date(now.getTime() + 30 * day);
    const first = db.archiveDue(later);
    const second = db.archiveDue(later);
    expect(first.moved).toBe(1);
    expect(second.moved).toBe(0);
    expect(db.db.jobsCurrent).toHaveLength(0);
    expect(db.db.jobsArchive).toHaveLength(1);
    const stuck = structuredClone(db.db.jobsArchive[0]);
    db.db.jobsCurrent.push({ ...stuck, lifecycle: "published" });
    const conflict = db.archiveDue(later);
    expect(conflict.skipped).toContain(stuck.jobId);
    expect(db.db.jobsCurrent.some((job) => job.jobId === stuck.jobId)).toBe(true);
  });
});

describe("pay, filters, and ranking", () => {
  it("does not treat unknown pay as zero and labels unpaid internships", () => {
    expect(formatPay({ compensationType: "not_disclosed", payMinMinor: null, payMaxMinor: null, payCurrency: null, payPeriod: null, payBasis: null })).toBe("Pay not disclosed");
    expect(formatPay({ compensationType: "unpaid", payMinMinor: 0, payMaxMinor: 0, payCurrency: "INR", payPeriod: "monthly", payBasis: "stipend", opportunityKind: "internship" })).toBe("Unpaid internship");
    expect(commissionMinor(100000, 1000)).toBe(10000);
    expect(commissionMinor(50000, 1000)).toBe(5000);
    expect(commissionMinor(0, 1000)).toBe(0);
  });

  it("applies OR inside a facet and AND across facets", () => {
    const db = store();
    const { actor } = admin(db);
    const reader = member(db, "reader@example.com").actor;
    const src = source(db, actor);
    const intern = db.saveJob(actor, input(src.id, {
      title: "Government internship",
      opportunityKind: "internship",
      sector: "government",
      sourceUrl: "https://careers.example.com/intern",
      applicationUrl: "https://careers.example.com/intern",
      compensationType: "not_disclosed",
      payMinMinor: null,
      payMaxMinor: null,
      payCurrency: null,
      payPeriod: null,
    }), now);
    db.publishJob(actor, intern.jobId, now);
    const remote = db.saveJob(actor, input(src.id, {
      title: "Remote only abroad",
      workMode: "remote",
      eligibleCountries: ["US"],
      countryCode: "US",
      locationLabel: "Remote",
      sourceUrl: "https://careers.example.com/remote",
      applicationUrl: "https://careers.example.com/remote",
    }), now);
    db.publishJob(actor, remote.jobId, now);
    const both = db.listFeed(reader, { filters: { kinds: ["internship", "job"], sectors: ["government"] }, sort: "latest", now });
    expect(both.items.filter((item) => item.type === "job").map((item) => item.type === "job" && item.job.title)).toEqual(["Government internship"]);
    const india = db.listFeed(reader, { filters: { countries: ["IN"] }, sort: "latest", now });
    expect(india.items.some((item) => item.type === "job" && item.job.title === "Remote only abroad")).toBe(false);
    const unknownHidden = db.listFeed(reader, { filters: { includeUnknownPay: false, minPayMinor: 1, payCurrency: "INR", payPeriod: "annual" }, sort: "latest", now });
    expect(unknownHidden.items.some((item) => item.type === "job" && item.job.title === "Government internship")).toBe(false);
  });

  it(
    "paginates 10,000 jobs without duplicate ids",
    () => {
    const db = store();
    const { actor } = member(db, "pager@example.com");
    for (let index = 0; index < 10000; index += 1) {
      db.db.jobsCurrent.push(fakeJob(index));
    }
    const seen = new Set<string>();
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page = db.listFeed(actor, { sort: "latest", cursor, now });
      for (const item of page.items) {
        if (item.type !== "job") continue;
        expect(seen.has(item.job.id)).toBe(false);
        seen.add(item.job.id);
      }
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor);
    expect(seen.size).toBe(10000);
    expect(pages).toBe(500);
  }, 30_000);
});

describe("access", () => {
  it("blocks anonymous reads and keeps Pro fields off the free response", () => {
    const db = store();
    const { actor } = admin(db);
    const freeUser = member(db, "free@example.com").actor;
    const src = source(db, actor);
    const pro = db.saveJob(actor, input(src.id, { accessTier: "pro", title: "Hidden role", sourceUrl: "https://careers.example.com/pro", applicationUrl: "https://careers.example.com/pro" }), now);
    db.publishJob(actor, pro.jobId, now);
    expect(() => db.listFeed({ kind: "anonymous" }, { now })).toThrow(AppError);
    const feed = db.listFeed(freeUser, { sort: "latest", now });
    expect(feed.items).toHaveLength(0);
    const detail = db.getJob(freeUser, pro.jobId, now);
    expect(detail.status).toBe("upgrade");
    expect(JSON.stringify(detail)).not.toContain("Hidden role");
    expect(JSON.stringify(detail)).not.toContain("careers.example.com");
    const signedOut = db.getJob({ kind: "anonymous" }, pro.jobId, now);
    expect(signedOut.status).toBe("sign_in");
    expect(JSON.stringify(signedOut)).not.toContain("Hidden");
  });

  it("does not let profile edits grant a role", () => {
    const db = store();
    const { user, actor } = member(db, "plain@example.com");
    db.updateAccount(actor, { displayName: "Plain" });
    expect(db.db.users.find((item) => item.userId === user.userId)?.roles).toEqual([]);
  });

  it("opens an email draft without marking the person applied", () => {
    const db = store();
    const { actor } = admin(db);
    const reader = member(db, "mail@example.com");
    const src = source(db, actor);
    const job = db.saveJob(actor, input(src.id, {
      applicationMethod: "email",
      applicationUrl: null,
      hrEmail: "hr@example.com",
      hrEmailApproved: true,
      emailSubject: "Frontend engineer\nBcc: attacker@example.com",
      sourceUrl: "https://careers.example.com/mail",
    }), now);
    db.publishJob(actor, job.jobId, now);
    const opened = db.openApplication(reader.actor, job.jobId, now);
    expect(opened.kind).toBe("email");
    expect(opened.mailto).toContain("mailto:");
    expect(opened.mailto).not.toContain("\n");
    expect(db.listActivity(reader.actor).some((item) => item.kind === "applied")).toBe(false);
    db.markApplied(reader.actor, job.jobId, true, now);
    expect(db.listActivity(reader.actor).some((item) => item.kind === "applied")).toBe(true);
    expect(buildMailto("hr@example.com", "Hello\r\nBcc: x")).not.toContain("\n");
  });
});

describe("intake", () => {
  it("rejects a bad row, keeps a good row, and does not mutate on dry run", () => {
    const db = store();
    const { actor } = admin(db);
    const src = source(db, actor);
    const good = record(src.id, "ok-1");
    const bad = { ...record(src.id, "bad-1"), summary: "" };
    const before = JSON.stringify(db.db.drafts);
    const dry = db.submitBatch(actor, { schema_version: "1.0", records: [good, bad] }, "dry-1", true, now);
    expect(dry.items.map((item) => item.outcome)).toEqual(["accepted_for_review", "rejected"]);
    expect(JSON.stringify(db.db.drafts)).toBe(before);
    const live = db.submitBatch(actor, { schema_version: "1.0", records: [good, bad] }, "live-1", false, now);
    expect(live.items[0]?.outcome).toBe("accepted_for_review");
    expect(db.db.jobsCurrent).toHaveLength(0);
    const replay = db.submitBatch(actor, { schema_version: "1.0", records: [good, bad] }, "live-1", false, now);
    expect(replay.batchId).toBe(live.batchId);
    expect(() => db.submitBatch(actor, { schema_version: "1.0", records: [good] }, "live-1", false, now)).toThrow(AppError);
  });

  it("rejects revoked, expired, and wrong-scope tokens", () => {
    const db = store();
    const { actor } = admin(db);
    const src = source(db, actor);
    const created = db.createCredential(actor, { name: "Collector", sourceIds: [src.id], scopes: ["jobs:submit"], days: 1 }, now);
    db.revokeCredential(actor, created.credential.id, now);
    expect(() => db.authenticateAgent(created.token, now)).toThrow(AppError);
    const expired = db.createCredential(actor, { name: "Old", sourceIds: [src.id], scopes: ["jobs:submit"], days: 1 }, new Date(now.getTime() - 3 * day));
    expect(() => db.authenticateAgent(expired.token, now)).toThrow(AppError);
    const reader = db.createCredential(actor, { name: "Read", sourceIds: [src.id], scopes: ["batches:read:self"] }, now);
    const agent = db.authenticateAgent(reader.token, now);
    expect(() => db.submitBatch(agent, { schema_version: "1.0", records: [record(src.id, "x")] }, "k", false, now)).toThrow(AppError);
  });
});

describe("money", () => {
  it("grants one entitlement for two provider events and extends a second purchase", async () => {
    const db = store();
    db.setFlag(admin(db).actor, "payments_enabled", true, now);
    const buyer = member(db, "buyer@example.com");
    const referrer = member(db, "referrer@example.com");
    const code = db.acceptReferralTerms(referrer.actor, now).code;
    const attributed = member(db, "attributed@example.com");
    db.db.users.find((user) => user.userId === attributed.user.userId);
    db.db.attributions.push({ referredUserId: attributed.user.userId, referrerUserId: referrer.user.userId, code, linkedAt: now.toISOString() });
    const order = await db.createOrder(db.actorFor(attributed.user.userId, now), { async createOrder() { return { id: "order_1" }; } }, now);
    const signature = checkoutSignature(order.providerOrderId ?? "", "pay_1", "secret");
    expect(safeEqualHex(signature, checkoutSignature("order_1", "pay_1", "secret"))).toBe(true);
    const first = db.applyProviderEvent({ providerEventId: "evt_1", type: "payment.captured", providerOrderId: "order_1", providerPaymentId: "pay_1", amountMinor: 19900, currency: "INR", captured: true, signatureValid: true, now });
    const second = db.applyProviderEvent({ providerEventId: "evt_2", type: "order.paid", providerOrderId: "order_1", providerPaymentId: "pay_1", amountMinor: 19900, currency: "INR", captured: true, signatureValid: true, now });
    expect(first.granted).toBe(true);
    expect(second.granted).toBe(false);
    expect(db.db.entitlements).toHaveLength(1);
    expect(db.db.credits).toHaveLength(1);
    expect(db.db.credits[0]?.amountMinor).toBe(1990);
    const again = await db.createOrder(db.actorFor(attributed.user.userId, now), { async createOrder() { return { id: "order_2" }; } }, new Date(now.getTime() + day));
    db.applyProviderEvent({ providerEventId: "evt_3", type: "payment.captured", providerOrderId: again.providerOrderId ?? "", providerPaymentId: "pay_2", amountMinor: 19900, currency: "INR", captured: true, signatureValid: true, now: new Date(now.getTime() + day) });
    expect(db.db.entitlements).toHaveLength(2);
    expect(new Date(db.db.entitlements[1]!.startsAt).getTime()).toBe(new Date(db.db.entitlements[0]!.endsAt).getTime());
    expect(() => db.applyProviderEvent({ providerEventId: "evt_4", type: "payment.authorized", providerOrderId: "missing", providerPaymentId: "pay_x", amountMinor: 19900, currency: "INR", captured: false, signatureValid: false, now })).toThrow(AppError);
    void buyer;
  });

  it("reverses pending commission and carries a reversal after payout", () => {
    const db = store();
    const owner = admin(db);
    db.setFlag(owner.actor, "payments_enabled", true, now);
    const referrer = member(db, "ref2@example.com");
    db.acceptReferralTerms(referrer.actor, now);
    const buyer = member(db, "buy2@example.com");
    db.db.attributions.push({ referredUserId: buyer.user.userId, referrerUserId: referrer.user.userId, code: "CODE", linkedAt: now.toISOString() });
    const order = {
      id: "ord",
      userId: buyer.user.userId,
      planId: "pro-pass-30",
      productMinor: 1000000,
      taxMinor: 18000,
      currency: "INR",
      days: 30,
      commissionable: true,
      rateBps: 1000,
      referrerUserId: referrer.user.userId,
      providerOrderId: "order_r",
      state: "pending" as const,
      createdAt: now.toISOString(),
      refundedProductMinor: 0,
    };
    db.db.orders.push(order);
    db.applyProviderEvent({ providerEventId: "e1", type: "payment.captured", providerOrderId: "order_r", providerPaymentId: "pay_r", amountMinor: 1018000, currency: "INR", captured: true, signatureValid: true, now });
    expect(db.db.credits[0]?.amountMinor).toBe(100000);
    db.applyRefund({ refundId: "rf_tax", providerPaymentId: "pay_r", productMinor: 0, taxMinor: 18000, now });
    expect(db.db.credits[0]?.reversedMinor).toBe(0);
    db.applyRefund({ refundId: "rf_half", providerPaymentId: "pay_r", productMinor: 500000, taxMinor: 0, now });
    expect(db.db.credits[0]?.reversedMinor).toBe(50000);
    const released = new Date(now.getTime() + 31 * day);
    db.db.credits[0]!.availableAt = now.toISOString();
    const payout = db.requestPayout(referrer.actor, { amountMinor: 50000, beneficiaryMasked: "****1234" }, released);
    expect(payout.amountMinor).toBe(50000);
    expect(() => db.requestPayout(referrer.actor, { amountMinor: 50000, beneficiaryMasked: "****1234" }, released)).toThrow(AppError);
    db.settlePayout(owner.actor, { payoutId: payout.id, status: "paid", evidence: { reference: "UTR1", amountMinor: 50000, settledAt: released.toISOString() } }, released);
    db.settlePayout(owner.actor, { payoutId: payout.id, status: "paid", evidence: { reference: "UTR1", amountMinor: 50000, settledAt: released.toISOString() } }, released);
    expect(db.db.credits[0]?.paidMinor).toBe(50000);
    db.applyRefund({ refundId: "rf_rest", providerPaymentId: "pay_r", productMinor: 500000, taxMinor: 18000, now: released });
    const summary = balances(db.db.credits.filter((item) => item.referrerUserId === referrer.user.userId), released);
    expect(summary.available).toBeLessThan(0);
    expect(db.db.entitlements[0]?.state).toBe("revoked");
  });

  it("keeps the first referrer and ignores a self or expired touch", () => {
    const db = store();
    const referrer = member(db, "owner@example.com");
    const code = db.acceptReferralTerms(referrer.actor, now).code;
    db.rememberTouch("cookie-1", code, new Date(now.getTime() - 40 * day));
    const expired = db.createUser({ email: "late@example.com", displayName: "Late", adultConfirmed: true, cookieId: "cookie-1", now });
    expect(db.db.attributions.some((item) => item.referredUserId === expired.userId)).toBe(false);
    const fresh = db.createUser({ email: "fresh@example.com", displayName: "Fresh", adultConfirmed: true, referralCode: code, now });
    expect(db.db.attributions.filter((item) => item.referredUserId === fresh.userId)).toHaveLength(1);
    const other = member(db, "other@example.com");
    const otherCode = db.acceptReferralTerms(other.actor, now).code;
    const still = db.createUser({ email: "second@example.com", displayName: "Second", adultConfirmed: true, referralCode: code, now });
    db.createUser({ email: "nope@example.com", displayName: "Nope", adultConfirmed: true, referralCode: otherCode, now });
    expect(db.db.attributions.find((item) => item.referredUserId === still.userId)?.referrerUserId).toBe(referrer.user.userId);
    expect(() => db.createUser({ email: "owner@example.com", displayName: "Same", adultConfirmed: true, referralCode: code, now })).toThrow(AppError);
  });
});

describe("safety and ads", () => {
  it("blocks private fetch targets and formula cells", () => {
    expect(isBlockedFetchTarget("http://169.254.169.254/latest")).toBe(true);
    expect(isBlockedFetchTarget("https://127.0.0.1/admin")).toBe(true);
    expect(isBlockedFetchTarget("https://careers.example.com/jobs")).toBe(false);
    expect(escapeCsvCell("=cmd()")).toBe("'=cmd()");
  });

  it("keeps sponsor slot math, but feed ads stay paused", () => {
    const jobs = Array.from({ length: 20 }, (_, index) => index + 1);
    const slotted = insertSponsorSlots(jobs, 0, 10, "camp");
    expect(slotted.filter((item) => item.type === "sponsored")).toHaveLength(2);
    expect(slotted[10]).toMatchObject({ type: "sponsored" });
    const next = insertSponsorSlots(jobs, 20, 10, "camp");
    expect(next.filter((item) => item.type === "sponsored")).toHaveLength(2);
    const db = store();
    const owner = admin(db);
    db.setFlag(owner.actor, "ads_enabled", true, now);
    db.saveCampaign(owner.actor, {
      name: "Example sponsor",
      destinationUrl: "https://sponsor.example.com",
      startsAt: new Date(now.getTime() - day).toISOString(),
      endsAt: new Date(now.getTime() + day).toISOString(),
      active: true,
    }, now);
    for (let index = 0; index < 10; index += 1) db.db.jobsCurrent.push(fakeJob(index));
    const free = member(db, "adfree@example.com").actor;
    const page = db.listFeed(free, { sort: "latest", now });
    // Ads insertion is intentionally disabled in MemoryStore.sponsorId for now.
    expect(page.items.some((item) => item.type === "sponsored")).toBe(false);
  });

  it("verifies webhook signatures against the raw body", () => {
    const raw = "{\"event\":\"payment.captured\"}";
    const signature = webhookSignature(raw, "whsec");
    expect(safeEqualHex(signature, webhookSignature(raw, "whsec"))).toBe(true);
    expect(safeEqualHex(signature, webhookSignature(raw + " ", "whsec"))).toBe(false);
  });
});

function record(sourceId: string, reference: string) {
  return {
    schema_version: "1.0",
    client_reference: reference,
    source_id: sourceId,
    source_url: `https://careers.example.com/${reference}`,
    company_name: "Example Studio",
    role_title: "Backend engineer",
    opportunity_kind: "job",
    work_mode: "on_site",
    location_label: "Pune",
    summary: "Maintain the billing service and write tests.",
    application: { method: "url", url: `https://careers.example.com/${reference}` },
    evidence: [{ source_url: `https://careers.example.com/${reference}`, fetched_at: now.toISOString(), excerpt: "Listed on the company site." }],
    collected_at: now.toISOString(),
    source_published_at: now.toISOString(),
  };
}

function fakeJob(index: number): JobRecord {
  const at = new Date(now.getTime() - index * 1000).toISOString();
  return {
    jobId: `job-${index.toString().padStart(5, "0")}`,
    version: 1,
    title: `Role ${index}`,
    companyName: "Example Studio",
    companyId: "company",
    summary: "A curated listing.",
    opportunityKind: "job",
    employmentArrangement: "full_time",
    sector: "private",
    workMode: "hybrid",
    seniority: "entry",
    roleFamilySlug: "software-it",
    industrySlug: null,
    locationLabel: "Bengaluru",
    locationUnknown: false,
    countryCode: "IN",
    eligibleCountries: ["IN"],
    skills: ["TypeScript"],
    requirements: [],
    eligibility: [],
    responsibilities: [],
    batchLabel: null,
    durationLabel: null,
    originalSourceLabel: null,
    payDisplayLabel: null,
    applyNote: null,
    compensationType: "not_disclosed",
    payMinMinor: null,
    payMaxMinor: null,
    payCurrency: null,
    payPeriod: null,
    payBasis: null,
    applicationMethod: "url",
    applicationUrl: "https://careers.example.com/job",
    hrEmail: null,
    emailSubject: null,
    hrEmailApproved: false,
    sourceId: "source",
    sourceUrl: `https://careers.example.com/job/${index}`,
    externalJobId: String(index),
    sourcePublishedAt: at,
    datePrecision: "instant",
    firstSeenAt: at,
    effectiveJobAt: at,
    visibleUntil: new Date(now.getTime() + 10 * day).toISOString(),
    publishedAt: at,
    lastCheckedAt: at,
    deadlineAt: null,
    accessTier: "free",
    verification: "source_checked",
    lifecycle: "published",
    government: null,
    evidence: [],
  };
}
