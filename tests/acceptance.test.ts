import { describe, expect, it } from "vitest";
import { product } from "@/shared/product";
import { formatPay } from "@/domain/jobs/pay";
import { isVisibleAt } from "@/domain/jobs/visibility";
import { buildMailto, escapeCsvCell, isBlockedFetchTarget } from "@/domain/safety";
import { AppError } from "@/http";
import { MemoryStore, type JobInput } from "@/repositories/memory";
import type { Actor, JobRecord } from "@/domain/types";
import { parseJobImportJson } from "@/shared/job-json-import";

const now = new Date("2026-11-10T08:00:00.000Z");
const day = 24 * 60 * 60 * 1000;

function store() {
  return new MemoryStore();
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
  it("hides a job at exactly 14 days and keeps it one hour earlier", () => {
    const effective = new Date("2026-10-11T08:00:00.000Z");
    const cutoff = new Date(effective.getTime() + 14 * day);
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

  it("allows a fresh import after an archived listing with the same external id", () => {
    const db = store();
    const { actor } = admin(db);
    const src = source(db, actor);
    const created = db.saveJob(actor, input(src.id, { externalJobId: "SWE-2026-001", sourceUrl: "https://careers.example.com/swe-1" }), now);
    db.publishJob(actor, created.jobId, now);
    db.deleteJob(actor, created.jobId, now);
    expect(db.db.jobsCurrent).toHaveLength(0);
    const again = db.saveJob(actor, input(src.id, { externalJobId: "SWE-2026-001", sourceUrl: "https://careers.example.com/swe-1" }), now);
    expect(again.jobId).not.toBe(created.jobId);
    expect(again.lifecycle).toBe("draft");
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
    const later = new Date(now.getTime() + 14 * day);
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
    expect(pages).toBe(200);
  }, 30_000);
});

describe("access", () => {
  it("blocks anonymous reads and shows listings to signed-in members", () => {
    const db = store();
    const { actor } = admin(db);
    const freeUser = member(db, "free@example.com").actor;
    const src = source(db, actor);
    const job = db.saveJob(actor, input(src.id, { title: "Open role", sourceUrl: "https://careers.example.com/open", applicationUrl: "https://careers.example.com/open" }), now);
    db.publishJob(actor, job.jobId, now);
    expect(() => db.listFeed({ kind: "anonymous" }, { now })).toThrow(AppError);
    const feed = db.listFeed(freeUser, { sort: "latest", now });
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0]?.job.title).toBe("Open role");
    const detail = db.getJob(freeUser, job.jobId, now);
    expect(detail.status).toBe("ok");
    const signedOut = db.getJob({ kind: "anonymous" }, job.jobId, now);
    expect(signedOut.status).toBe("sign_in");
    expect(JSON.stringify(signedOut)).not.toContain("Open role");
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

  it("lets an admin publish an email draft without a prior approval checkbox", () => {
    const db = store();
    const { actor } = admin(db);
    const src = source(db, actor);
    const job = db.saveJob(actor, input(src.id, {
      title: "AI Intern",
      companyName: "Krystelis Ltd",
      applicationMethod: "email",
      applicationUrl: null,
      hrEmail: "bhawna.ghoghaliya@krystelis.com",
      hrEmailApproved: false,
      sourceUrl: "https://pikajobs.com/import/tg-krystelis",
    }), now);
    expect(job.lifecycle).toBe("draft");
    const published = db.publishJob(actor, job.jobId, now);
    expect(published.lifecycle).toBe("published");
    expect(published.hrEmailApproved).toBe(true);
    expect(db.db.jobsCurrent).toHaveLength(1);
    expect(db.db.drafts).toHaveLength(0);
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

describe("safety", () => {
  it("blocks private fetch targets and formula cells", () => {
    expect(isBlockedFetchTarget("http://169.254.169.254/latest")).toBe(true);
    expect(isBlockedFetchTarget("https://127.0.0.1/admin")).toBe(true);
    expect(isBlockedFetchTarget("https://careers.example.com/jobs")).toBe(false);
    expect(escapeCsvCell("=cmd()")).toBe("'=cmd()");
  });
});

describe("admin json import", () => {
  it("gives email-only jobs unique source urls and keeps company names on skips", () => {
    const parsed = parseJobImportJson({
      generated_date: "2026-11-13",
      jobs: [
        {
          id: "tg-1",
          title: "Frontend Intern",
          company: "Es Magico",
          apply: { email: "careers+nov26@esmagico.com" },
        },
        {
          id: "tg-2",
          title: "DevOps Intern",
          company: "Es Magico",
          apply: { email: "careers+nov26@esmagico.com" },
        },
        {
          id: "tg-3",
          title: "Mystery Intern",
          company: "No Contact Co",
          apply: { url: "", email: "" },
        },
      ],
    });
    expect(parsed.totalCount).toBe(3);
    expect(parsed.drafts).toHaveLength(2);
    expect(parsed.drafts[0]?.sourceUrl).not.toBe(parsed.drafts[1]?.sourceUrl);
    expect(parsed.drafts[0]?.sourceUrl).toMatch(/\/import\//);
    expect(parsed.skipped).toEqual([
      expect.objectContaining({
        company: "No Contact Co",
        title: "Mystery Intern",
        reason: "Missing application link, email, phone, or walk-in details.",
      }),
    ]);
  });

  it("saves two email listings that share the placeholder source url", () => {
    const db = store();
    const { actor } = admin(db);
    const src = source(db, actor);
    const one = db.saveJob(actor, input(src.id, {
      title: "Frontend Intern",
      companyName: "Es Magico",
      applicationMethod: "email",
      applicationUrl: null,
      hrEmail: "careers+nov26@esmagico.com",
      hrEmailApproved: true,
      sourceUrl: "https://pikajobs.com",
      externalJobId: "tg-20261113-004",
    }), now);
    const two = db.saveJob(actor, input(src.id, {
      title: "DevOps Intern",
      companyName: "Es Magico",
      applicationMethod: "email",
      applicationUrl: null,
      hrEmail: "careers+nov26@esmagico.com",
      hrEmailApproved: true,
      sourceUrl: "https://pikajobs.com",
      externalJobId: "tg-20261113-008",
    }), now);
    expect(one.jobId).not.toBe(two.jobId);
    expect(db.db.drafts).toHaveLength(2);
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
