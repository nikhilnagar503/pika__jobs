import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { intakeBatchSchema, intakeRecordSchema } from "@/shared/job-intake";
import { product } from "@/shared/product";
import { insertSponsorSlots, type FeedItem } from "@/domain/ads";
import { compareLatest, emptyFilters, matchesFilters, scoreJob, type FeedFilters } from "@/domain/jobs/feed";
import { formatPay, validatePay } from "@/domain/jobs/pay";
import {
  computeVisibleUntil,
  isVisibleAt,
  publicationBlockReason,
  resolveEffectiveJobAt,
} from "@/domain/jobs/visibility";
import {
  commissionMinor,
  entitlementWindow,
  fingerprint,
  generateAgentToken,
  referralCode,
  tokenMatches,
} from "@/domain/money";
import { assertPublicHttpUrl, buildMailto, isBlockedFetchTarget, plainText } from "@/domain/safety";
import { canReadTier, type Actor, type JobRecord, type Preferences, type UserAccount } from "@/domain/types";
import { AppError } from "@/http";
import {
  audit,
  balances,
  bodyHash,
  createDatabase,
  defaultPlan,
  emptyPreferences,
  proUntil,
  type BatchResult,
  type CampaignRecord,
  type CredentialRecord,
  type Database,
  type OrderRecord,
  type PayoutRecord,
  type SourceRecord,
} from "@/repositories/db";

export type JobInput = {
  jobId?: string;
  expectedVersion?: number;
  title: string;
  companyName: string;
  summary: string;
  opportunityKind: string;
  sector: string;
  workMode: string;
  roleFamilySlug?: string | null;
  locationLabel?: string;
  locationUnknown?: boolean;
  countryCode?: string | null;
  eligibleCountries?: string[];
  skills?: string[];
  requirements?: string[];
  eligibility?: string[];
  responsibilities?: string[];
  batchLabel?: string | null;
  durationLabel?: string | null;
  originalSourceLabel?: string | null;
  payDisplayLabel?: string | null;
  applyNote?: string | null;
  compensationType: string;
  payMinMinor?: number | null;
  payMaxMinor?: number | null;
  payCurrency?: string | null;
  payPeriod?: string | null;
  payBasis?: string | null;
  applicationMethod: "url" | "email" | "both";
  applicationUrl?: string | null;
  hrEmail?: string | null;
  emailSubject?: string | null;
  hrEmailApproved?: boolean;
  sourceId: string;
  sourceUrl: string;
  externalJobId?: string | null;
  sourcePublishedAt?: string | null;
  deadlineAt?: string | null;
  accessTier: "free" | "pro";
  verification?: string;
  government?: Record<string, string> | null;
  evidenceExcerpt?: string;
};

export type JobCard = {
  id: string;
  title: string;
  companyName: string;
  companyInitials: string;
  locationLabel: string;
  workMode: string;
  payLabel: string;
  opportunityKind: string;
  sector: string;
  skills: string[];
  requirements: string[];
  eligibility: string[];
  responsibilities: string[];
  batchLabel: string | null;
  durationLabel: string | null;
  originalSourceLabel: string | null;
  applyNote: string | null;
  summary: string;
  effectiveJobAt: string;
  datePrecision: "instant" | "date";
  sourcePublishedAt: string | null;
  lastCheckedAt: string | null;
  deadlineAt: string | null;
  accessTier: "free" | "pro";
  reasons: string[];
  applicationKind: "url" | "email" | "both";
  applicationUrl: string | null;
  hrEmail: string | null;
  emailSubject: string | null;
  saved: boolean;
};

export type FeedPage = {
  items: FeedItem<JobCard>[];
  nextCursor: string | null;
  asOf: string;
  total: number;
  sponsor: { id: string; name: string; destinationUrl: string } | null;
};

type Cursor = {
  sort: "latest" | "for_you";
  asOf: string;
  at: string;
  id: string;
  score?: number;
};

export class MemoryStore {
  constructor(
    readonly db: Database = createDatabase(),
    private readonly options: { paymentsEnabled?: boolean; sessionSecret?: string } = {},
  ) {}

  createUser(input: {
    email: string;
    displayName: string;
    adultConfirmed: boolean;
    referralCode?: string | null;
    cookieId?: string | null;
    now?: Date;
  }): UserAccount {
    const now = input.now ?? new Date();
    if (!input.adultConfirmed) {
      throw new AppError(422, "age_required", "Pikajobs is for adults aged 18 and over.");
    }
    const email = input.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError(422, "invalid_email", "Enter a valid email.");
    }
    if (this.db.users.some((user) => user.email === email && !user.deletedAt)) {
      throw new AppError(409, "account_exists", "An account with this email already exists. Sign in instead.");
    }
    const user: UserAccount = {
      userId: crypto.randomUUID(),
      email,
      displayName: input.displayName.trim().slice(0, 80) || email.split("@")[0],
      countryCode: "IN",
      currentStage: "",
      onboardingStep: 0,
      onboardingCompleted: false,
      adultConfirmed: true,
      roles: [],
      suspended: false,
      createdAt: now.toISOString(),
      deletedAt: null,
      referralCode: null,
      referralTermsAcceptedAt: null,
    };
    if (email === product.adminEmail && !this.db.bootstrapConsumed) {
      user.roles = ["admin", "finance"];
      this.db.bootstrapConsumed = true;
      audit(this.db, user.userId, "bootstrap_admin", user.userId, "Bound the initial admin.", now.toISOString());
    }
    this.db.users.push(user);
    this.db.preferences.push(emptyPreferences(user.userId, now.toISOString()));
    this.attributeNewUser(user, input.referralCode, input.cookieId, now);
    return user;
  }

  /** Sync a Supabase Auth user into the local domain store (same UUID). */
  ensureAuthUser(input: {
    userId: string;
    email: string;
    displayName: string;
    adultConfirmed: boolean;
    roles: string[];
    referralCode?: string | null;
    now?: Date;
  }): UserAccount {
    const now = input.now ?? new Date();
    const email = input.email.trim().toLowerCase();
    let user = this.db.users.find((item) => item.userId === input.userId && !item.deletedAt);
    if (!user) {
      const byEmail = this.db.users.find((item) => item.email === email && !item.deletedAt);
      if (byEmail) {
        const oldId = byEmail.userId;
        byEmail.userId = input.userId;
        for (const prefs of this.db.preferences) {
          if (prefs.userId === oldId) prefs.userId = input.userId;
        }
        user = byEmail;
      } else {
        user = {
          userId: input.userId,
          email,
          displayName: input.displayName.trim().slice(0, 80) || email.split("@")[0],
          countryCode: "IN",
          currentStage: "",
          onboardingStep: 0,
          onboardingCompleted: false,
          adultConfirmed: input.adultConfirmed,
          roles: [...input.roles],
          suspended: false,
          createdAt: now.toISOString(),
          deletedAt: null,
          referralCode: null,
          referralTermsAcceptedAt: null,
        };
        this.db.users.push(user);
        this.db.preferences.push(emptyPreferences(user.userId, now.toISOString()));
        this.attributeNewUser(user, input.referralCode, null, now);
      }
    }
    user.email = email;
    user.displayName = input.displayName.trim().slice(0, 80) || user.displayName;
    user.adultConfirmed = input.adultConfirmed;
    user.roles = [...input.roles];
    return user;
  }

  actorFor(userId: string, now = new Date()): Actor {
    const user = this.db.users.find((item) => item.userId === userId && !item.deletedAt);
    if (!user) return { kind: "anonymous" };
    return {
      kind: "user",
      userId: user.userId,
      email: user.email,
      roles: [...user.roles],
      proUntil: proUntil(this.db, user.userId),
      suspended: user.suspended,
    };
  }

  updateAccount(
    actor: Actor,
    patch: { displayName?: string; countryCode?: string; currentStage?: string },
  ): UserAccount {
    const user = this.user(actor);
    if (patch.displayName != null) user.displayName = patch.displayName.trim().slice(0, 80);
    if (patch.countryCode != null) user.countryCode = patch.countryCode.trim().slice(0, 8) || "IN";
    if (patch.currentStage != null) user.currentStage = patch.currentStage.slice(0, 80);
    return user;
  }

  savePreferences(actor: Actor, patch: Partial<Preferences> & { step?: number; complete?: boolean }, now = new Date()): Preferences {
    const user = this.user(actor);
    const prefs = this.prefs(user.userId, now);
    const allow: (keyof Preferences)[] = [
      "opportunityKinds",
      "sectors",
      "roleFamilySlugs",
      "skillSlugs",
      "workModes",
      "locationLabel",
      "countryCode",
      "experienceBand",
      "stage",
      "showUnknownPay",
      "jobPayTargetMinor",
      "internshipPayTargetMinor",
      "otherRoleNote",
    ];
    for (const key of allow) {
      if (patch[key] !== undefined) {
        (prefs as unknown as Record<string, unknown>)[key] = patch[key];
      }
    }
    prefs.skillSlugs = prefs.skillSlugs.slice(0, 10);
    prefs.otherRoleNote = prefs.otherRoleNote.slice(0, 80);
    prefs.updatedAt = now.toISOString();
    if (patch.step != null) user.onboardingStep = patch.step;
    if (patch.complete) user.onboardingCompleted = true;
    if (patch.stage) user.currentStage = patch.stage;
    return prefs;
  }

  getPreferences(actor: Actor): Preferences {
    const user = this.user(actor);
    return this.prefs(user.userId, new Date());
  }

  listFeed(actor: Actor, input: { filters?: Partial<FeedFilters>; sort?: "latest" | "for_you"; cursor?: string | null; preview?: "free" | "pro" | null; now?: Date }): FeedPage {
    const now = input.now ?? new Date();
    if (actor.kind !== "user" && actor.kind !== "system") {
      throw new AppError(401, "sign_in_required", "Sign in to view jobs.");
    }
    if (actor.kind === "user" && actor.suspended) throw new AppError(403, "suspended", "This account is suspended.");
    const preview = actor.kind === "user" && actor.roles.includes("admin") ? input.preview ?? null : null;
    const filters = { ...emptyFilters(), ...input.filters };
    filters.kinds = input.filters?.kinds ?? filters.kinds;
    filters.roleFamilies = input.filters?.roleFamilies ?? filters.roleFamilies;
    filters.sectors = input.filters?.sectors ?? filters.sectors;
    filters.workModes = input.filters?.workModes ?? filters.workModes;
    filters.countries = input.filters?.countries ?? filters.countries;
    if (input.filters?.includeUnknownPay == null && actor.kind === "user") {
      filters.includeUnknownPay = this.prefs(actor.userId, now).showUnknownPay;
    }
    const cursor = input.cursor ? decodeCursor(input.cursor) : null;
    const sort = cursor?.sort ?? input.sort ?? "latest";
    const asOf = cursor ? new Date(cursor.asOf) : now;
    const preferences = actor.kind === "user" ? this.prefs(actor.userId, now) : null;
    const visible = this.db.jobsCurrent.filter(
      (job) =>
        job.lifecycle === "published" &&
        isVisibleAt(new Date(job.visibleUntil), now) &&
        new Date(job.publishedAt ?? job.firstSeenAt).getTime() <= asOf.getTime() &&
        canReadTier(actor, job.accessTier, now, preview),
    );
    const matched = visible.filter((job) => matchesFilters(job, filters, asOf));
    const scored = matched.map((job) => ({ job, ...scoreJob(job, sort === "for_you" ? preferences : null, asOf) }));
    scored.sort((a, b) => (sort === "latest" ? compareLatest(a.job, b.job) : compareRanked(a, b)));
    const start = cursor ? scored.findIndex((item) => afterCursor(item, cursor, sort)) : 0;
    const from = start < 0 ? scored.length : start;
    const page = scored.slice(from, from + product.pageSize);
    const campaign = this.sponsorId(actor, now, preview);
    const savedIds =
      actor.kind === "user"
        ? new Set(this.db.saved.filter((item) => item.userId === actor.userId).map((item) => item.jobId))
        : new Set<string>();
    const items = insertSponsorSlots(
      page.map((item) => toCard(item.job, item.reasons, savedIds.has(item.job.jobId))),
      from,
      product.adInterval,
      campaign,
    );
    const last = page.at(-1);
    const nextCursor = from + page.length < scored.length && last
      ? encodeCursor({
          sort,
          asOf: asOf.toISOString(),
          at: last.job.effectiveJobAt,
          id: last.job.jobId,
          score: last.score,
        })
      : null;
    const sponsor = campaign
      ? this.db.campaigns.find((item) => item.id === campaign) ?? null
      : null;
    return {
      items,
      nextCursor,
      asOf: asOf.toISOString(),
      total: matched.length,
      sponsor: sponsor ? { id: sponsor.id, name: sponsor.name, destinationUrl: sponsor.destinationUrl } : null,
    };
  }

  getJob(actor: Actor, jobId: string, now = new Date(), preview: "free" | "pro" | null = null) {
    const job = this.findAny(jobId);
    if (!job || job.lifecycle === "draft" || job.lifecycle === "in_review") {
      throw new AppError(404, "not_available", "This listing is not available.");
    }
    const readable = job.lifecycle === "published" && isVisibleAt(new Date(job.visibleUntil), now) && this.db.jobsCurrent.some((item) => item.jobId === job.jobId);
    if (!readable) {
      return { status: "unavailable" as const };
    }
    if (actor.kind !== "user") return { status: "sign_in" as const };
    const mode = actor.roles.includes("admin") ? preview : null;
    if (!canReadTier(actor, job.accessTier, now, mode)) {
      return {
        status: "upgrade" as const,
        teaser: {
          opportunityKind: job.opportunityKind,
          workMode: job.workMode,
          disclosureStatus: job.compensationType === "not_disclosed" || job.payMinMinor == null ? "not_disclosed" : "disclosed",
        },
      };
    }
    const saved = this.db.saved.some((item) => item.userId === actor.userId && item.jobId === job.jobId);
    return {
      status: "ok" as const,
      job: {
        ...toCard(job, [], saved),
        verification: job.verification,
        sourceUrl: job.sourceUrl,
        eligibleCountries: job.eligibleCountries,
        government: job.government,
      },
    };
  }

  setSaved(actor: Actor, jobId: string, saved: boolean, now = new Date()) {
    const user = this.user(actor);
    this.assertReadable(actor, jobId, now);
    this.db.saved = this.db.saved.filter((item) => !(item.userId === user.userId && item.jobId === jobId));
    if (saved) this.db.saved.push({ userId: user.userId, jobId, createdAt: now.toISOString() });
    return { saved };
  }

  listSaved(actor: Actor, now = new Date()): JobCard[] {
    const user = this.user(actor);
    return this.db.saved
      .filter((item) => item.userId === user.userId)
      .map((item) => {
        const job = this.findAny(item.jobId);
        if (!job) return null;
        const live = job.lifecycle === "published" && isVisibleAt(new Date(job.visibleUntil), now);
        if (!live) {
          return {
            ...toCard(job, [], true),
            title: "Listing unavailable",
            summary: "This listing is no longer available.",
            applicationKind: "url" as const,
            payLabel: "Pay not disclosed",
            requirements: [],
            eligibility: [],
            responsibilities: [],
            applicationUrl: null,
            hrEmail: null,
            emailSubject: null,
          };
        }
        if (!canReadTier(actor, job.accessTier, now, null)) return null;
        return toCard(job, [], true);
      })
      .filter((item): item is JobCard => Boolean(item));
  }

  openApplication(actor: Actor, jobId: string, now = new Date()) {
    const user = this.user(actor);
    const job = this.assertReadable(actor, jobId, now);
    this.db.applications.push({ id: crypto.randomUUID(), userId: user.userId, jobId, kind: "opened", occurredAt: now.toISOString() });
    const subject = job.emailSubject || `${job.title} via Pikajobs ${job.jobId.slice(0, 8)}`;
    const mailto = job.hrEmail && job.hrEmailApproved ? buildMailto(job.hrEmail, subject) : null;
    if (job.applicationUrl && job.applicationMethod !== "email") {
      return { kind: job.applicationMethod, url: job.applicationUrl, mailto, email: mailto ? job.hrEmail : null };
    }
    if (mailto && job.hrEmail) {
      return { kind: "email" as const, url: null, mailto, email: job.hrEmail };
    }
    throw new AppError(409, "application_unavailable", "This listing has no approved application route.");
  }

  markApplied(actor: Actor, jobId: string, applied: boolean, now = new Date()) {
    const user = this.user(actor);
    this.assertReadable(actor, jobId, now);
    this.db.applications = this.db.applications.filter((item) => !(item.userId === user.userId && item.jobId === jobId && item.kind === "applied"));
    if (applied) {
      this.db.applications.push({ id: crypto.randomUUID(), userId: user.userId, jobId, kind: "applied", occurredAt: now.toISOString() });
    }
  }

  listActivity(actor: Actor) {
    const user = this.user(actor);
    return this.db.applications
      .filter((item) => item.userId === user.userId)
      .map((item) => {
        const job = this.findAny(item.jobId);
        return {
          id: item.id,
          jobId: item.jobId,
          kind: item.kind,
          occurredAt: item.occurredAt,
          title: job?.title ?? "Listing unavailable",
        };
      });
  }

  reportJob(actor: Actor, jobId: string, reason: string, detail: string, now = new Date()) {
    const user = this.user(actor);
    if (!this.findAny(jobId)) throw new AppError(404, "not_available", "This listing is not available.");
    this.db.reports.push({
      id: crypto.randomUUID(),
      userId: user.userId,
      jobId,
      reason: reason.slice(0, 80),
      detail: plainText(detail, 500),
      state: "open",
      createdAt: now.toISOString(),
    });
  }

  saveSource(actor: Actor, input: Omit<SourceRecord, "id" | "lastSuccessAt"> & { id?: string }, now = new Date()): SourceRecord {
    this.requireRole(actor, ["admin"]);
    if (input.canonicalDomain && isBlockedFetchTarget(`https://${input.canonicalDomain}`)) {
      throw new AppError(422, "invalid_source", "That source domain is not allowed.");
    }
    const existing = input.id ? this.db.sources.find((item) => item.id === input.id) : undefined;
    const source: SourceRecord = {
      id: existing?.id ?? crypto.randomUUID(),
      name: input.name.trim(),
      type: input.type,
      canonicalDomain: input.canonicalDomain.trim().toLowerCase(),
      permissionBasis: input.permissionBasis.trim(),
      enabled: input.enabled,
      boardId: input.boardId.trim(),
      lastSuccessAt: existing?.lastSuccessAt ?? null,
    };
    this.db.sources = this.db.sources.filter((item) => item.id !== source.id).concat(source);
    audit(this.db, this.actorId(actor), "save_source", source.id, source.name, now.toISOString());
    return source;
  }

  listSources(actor: Actor): SourceRecord[] {
    this.requireRole(actor, ["admin", "reviewer"]);
    return this.db.sources;
  }

  /** Always-available source for jobs typed in by the admin in the dashboard. */
  ensureManualListingSource(actor: Actor, now = new Date()): SourceRecord {
    this.requireRole(actor, ["admin", "reviewer"]);
    const existing = this.db.sources.find((item) => item.boardId === "manual-admin");
    if (existing) return existing;
    return this.saveSource(
      actor,
      {
        name: "Manual admin posts",
        type: "manual",
        canonicalDomain: "pikajobs.app",
        permissionBasis: "Entered manually by the Pikajobs admin workspace.",
        enabled: true,
        boardId: "manual-admin",
      },
      now,
    );
  }

  saveJob(actor: Actor, input: JobInput, now = new Date()): JobRecord {
    if (actor.kind !== "system") this.requireRole(actor, ["admin", "reviewer"]);
    const source = this.db.sources.find((item) => item.id === input.sourceId);
    if (!source) throw new AppError(422, "unknown_source", "Choose a registered source.");
    const payError = validatePay({
      compensationType: input.compensationType,
      payMinMinor: input.payMinMinor ?? null,
      payMaxMinor: input.payMaxMinor ?? null,
      payCurrency: input.payCurrency ?? null,
      payPeriod: input.payPeriod ?? null,
      payBasis: input.payBasis ?? null,
    });
    if (payError) throw new AppError(422, "invalid_pay", payError);
    if (input.applicationUrl) assertPublicHttpUrl(input.applicationUrl, "applicationUrl");
    if (input.sourceUrl) assertPublicHttpUrl(input.sourceUrl, "sourceUrl");
    const existing = input.jobId ? this.findAny(input.jobId) : this.findBySource(input.sourceId, input.externalJobId ?? null, input.sourceUrl);
    if (existing && (existing.lifecycle === "archived" || existing.lifecycle === "removed")) {
      throw new AppError(409, "archived", "Archived listings stay archived. A new posting needs a new identity.");
    }
    if (existing && input.expectedVersion == null) {
      throw new AppError(409, "version_required", "Send the listing version you edited.");
    }
    if (existing && input.expectedVersion != null && existing.version !== input.expectedVersion) {
      throw new AppError(409, "version_conflict", "This listing was updated. Reload it and try again.");
    }
    const firstSeen = existing?.firstSeenAt ?? now.toISOString();
    const resolved = resolveEffectiveJobAt({
      sourcePublishedAt: input.sourcePublishedAt ? new Date(input.sourcePublishedAt) : null,
      firstSeenAt: new Date(firstSeen),
      existingEffectiveJobAt: existing ? new Date(existing.effectiveJobAt) : null,
      now,
    });
    const deadline = input.deadlineAt ? new Date(input.deadlineAt) : null;
    const visibleUntil = computeVisibleUntil(resolved.effectiveJobAt, deadline);
    const company = this.company(input.companyName);
    const record: JobRecord = {
      jobId: existing?.jobId ?? crypto.randomUUID(),
      version: existing ? existing.version + 1 : 1,
      title: plainText(input.title, 180),
      companyName: company.displayName,
      companyId: company.id,
      summary: plainText(input.summary, 400),
      opportunityKind: input.opportunityKind,
      employmentArrangement: "not_stated",
      sector: input.sector,
      workMode: input.workMode,
      seniority: "not_stated",
      roleFamilySlug: input.roleFamilySlug ?? null,
      industrySlug: null,
      locationLabel: input.locationUnknown ? "Location not stated" : (input.locationLabel ?? "").trim(),
      locationUnknown: Boolean(input.locationUnknown),
      countryCode: input.countryCode ?? null,
      eligibleCountries: input.eligibleCountries ?? [],
      skills: (input.skills ?? []).slice(0, 8),
      requirements: (input.requirements ?? []).map((item) => plainText(item, 220)).slice(0, 8),
      eligibility: (input.eligibility ?? []).map((item) => plainText(item, 220)).slice(0, 6),
      responsibilities: (input.responsibilities ?? []).map((item) => plainText(item, 220)).slice(0, 8),
      batchLabel: input.batchLabel ? plainText(input.batchLabel, 80) : null,
      durationLabel: input.durationLabel ? plainText(input.durationLabel, 80) : null,
      originalSourceLabel: input.originalSourceLabel ? plainText(input.originalSourceLabel, 120) : null,
      payDisplayLabel: input.payDisplayLabel ? plainText(input.payDisplayLabel, 80) : null,
      applyNote: input.applyNote ? plainText(input.applyNote, 280) : null,
      compensationType: input.compensationType,
      payMinMinor: input.payMinMinor ?? null,
      payMaxMinor: input.payMaxMinor ?? null,
      payCurrency: input.payCurrency ?? null,
      payPeriod: input.payPeriod ?? null,
      payBasis: input.payBasis ?? null,
      applicationMethod: input.applicationMethod,
      applicationUrl: input.applicationUrl ?? null,
      hrEmail: input.hrEmail ?? null,
      emailSubject: input.emailSubject ?? null,
      hrEmailApproved: Boolean(input.hrEmailApproved),
      sourceId: source.id,
      sourceUrl: input.sourceUrl,
      externalJobId: input.externalJobId ?? null,
      sourcePublishedAt: input.sourcePublishedAt ?? null,
      datePrecision: "instant",
      firstSeenAt: firstSeen,
      effectiveJobAt: resolved.effectiveJobAt.toISOString(),
      visibleUntil: visibleUntil.toISOString(),
      publishedAt: existing?.publishedAt ?? null,
      lastCheckedAt: now.toISOString(),
      deadlineAt: input.deadlineAt ?? null,
      accessTier: input.accessTier,
      verification: input.verification ?? "unreviewed",
      lifecycle: existing?.lifecycle === "published" ? "published" : resolved.reviewReason ? "in_review" : "draft",
      government: input.government ?? null,
      evidence: [
        {
          sourceUrl: input.sourceUrl,
          fetchedAt: now.toISOString(),
          excerpt: plainText(input.evidenceExcerpt || input.summary, 500),
        },
      ],
    };
    if (!record.locationUnknown && !record.locationLabel) {
      throw new AppError(422, "location_required", "Add a location or mark it unknown.");
    }
    this.db.versions.push({
      jobId: record.jobId,
      version: record.version,
      summary: existing ? "Updated listing" : "Created draft",
      actorId: this.actorId(actor),
      at: now.toISOString(),
    });
    this.replaceJob(record);
    return record;
  }

  publishJob(actor: Actor, jobId: string, now = new Date()): JobRecord {
    if (actor.kind !== "system") this.requireRole(actor, ["admin", "reviewer"]);
    if (this.db.flags.publication_paused) throw new AppError(409, "publication_paused", "Publication is paused.");
    const job = this.findAny(jobId);
    if (!job) throw new AppError(404, "not_available", "This listing is not available.");
    if (job.lifecycle === "archived" || job.lifecycle === "removed") {
      throw new AppError(409, "archived", "Archived listings stay archived. A new posting needs a new identity.");
    }
    if (job.sourcePublishedAt && new Date(job.sourcePublishedAt).getTime() > now.getTime()) {
      throw new AppError(422, "needs_review", "The source date is in the future and needs review.");
    }
    const source = this.db.sources.find((item) => item.id === job.sourceId);
    if (!source?.enabled || !source.permissionBasis.trim()) {
      throw new AppError(422, "source_not_permitted", "Publish only from an enabled source with a recorded permission basis.");
    }
    if (!job.evidence.length) throw new AppError(422, "evidence_required", "Add source evidence before publishing.");
    if ((job.applicationMethod === "url" || job.applicationMethod === "both") && !job.applicationUrl) {
      throw new AppError(422, "application_required", "Add an application link.");
    }
    if ((job.applicationMethod === "email" || job.applicationMethod === "both") && (!job.hrEmail || !job.hrEmailApproved)) {
      throw new AppError(422, "email_not_approved", "HR email can be published only with explicit approval.");
    }
    const block = publicationBlockReason(new Date(job.effectiveJobAt), new Date(job.visibleUntil), now);
    if (block) throw new AppError(422, "not_publishable", block);
    const duplicate = this.crossSourceDuplicate(job);
    if (duplicate) throw new AppError(409, "needs_review", "A similar listing from another source needs review before publication.");
    job.lifecycle = "published";
    job.publishedAt = job.publishedAt ?? now.toISOString();
    job.verification = job.verification === "unreviewed" ? "source_checked" : job.verification;
    this.db.drafts = this.db.drafts.filter((item) => item.jobId !== job.jobId);
    this.db.jobsArchive = this.db.jobsArchive.filter((item) => item.jobId !== job.jobId);
    this.db.jobsCurrent = this.db.jobsCurrent.filter((item) => item.jobId !== job.jobId).concat(job);
    audit(this.db, this.actorId(actor), "publish_job", job.jobId, job.title, now.toISOString());
    this.assertLocations();
    return job;
  }

  archiveJob(actor: Actor, jobId: string, reason: string, now = new Date()) {
    this.requireRole(actor, ["admin", "reviewer"]);
    if (!reason.trim()) throw new AppError(422, "reason_required", "An archive reason is required.");
    const current = this.db.jobsCurrent.find((item) => item.jobId === jobId);
    if (!current) throw new AppError(404, "not_available", "This listing is not in the current collection.");
    current.lifecycle = reason === "safety_removal" ? "removed" : "archived";
    current.visibleUntil = now.toISOString();
    this.moveToArchive(current, reason, now);
    audit(this.db, this.actorId(actor), "archive_job", jobId, reason, now.toISOString());
  }

  archiveDue(now = new Date(), batchSize = 500): { moved: number; skipped: string[] } {
    const due = this.db.jobsCurrent.filter(
      (job) => new Date(job.visibleUntil).getTime() <= now.getTime() || job.lifecycle === "closed" || job.lifecycle === "removed",
    );
    const skipped: string[] = [];
    let moved = 0;
    for (const job of due.slice(0, batchSize)) {
      if (this.db.jobsArchive.some((item) => item.jobId === job.jobId)) {
        skipped.push(job.jobId);
        continue;
      }
      this.moveToArchive(job, job.lifecycle === "removed" ? "safety_removal" : "visibility_cutoff", now);
      moved += 1;
    }
    return { moved, skipped };
  }

  listAdminJobs(actor: Actor, scope: "current" | "archive" | "review") {
    this.requireRole(actor, ["admin", "reviewer"]);
    if (scope === "archive") return this.db.jobsArchive;
    if (scope === "review") return this.db.drafts;
    return this.db.jobsCurrent;
  }

  overview(actor: Actor, now = new Date()) {
    this.requireRole(actor, ["admin", "reviewer"]);
    return {
      liveFree: this.db.jobsCurrent.filter((job) => job.lifecycle === "published" && job.accessTier === "free" && isVisibleAt(new Date(job.visibleUntil), now)).length,
      livePro: this.db.jobsCurrent.filter((job) => job.lifecycle === "published" && job.accessTier === "pro" && isVisibleAt(new Date(job.visibleUntil), now)).length,
      pendingReview: this.db.drafts.length,
      openReports: this.db.reports.filter((item) => item.state === "open").length,
      paidOrders: this.db.orders.filter((item) => item.state === "paid").length,
      payoutQueue: this.db.payouts.filter((item) => !["paid", "failed", "rejected", "reversed"].includes(item.status)).length,
    };
  }

  createCredential(actor: Actor, input: { name: string; sourceIds: string[]; scopes: string[]; days?: number; dailyLimit?: number }, now = new Date()) {
    const user = this.requireRole(actor, ["admin"]);
    const scopes = input.scopes.filter((scope) => ["jobs:submit", "batches:read:self", "jobs:update:own-source"].includes(scope));
    if (!scopes.length) throw new AppError(422, "scope_required", "Choose at least one intake scope. Publishing is not available.");
    const token = generateAgentToken();
    const record: CredentialRecord = {
      id: crypto.randomUUID(),
      name: input.name.slice(0, 80),
      ownerId: user.userId,
      prefix: token.prefix,
      digest: token.digest,
      scopes,
      sourceIds: input.sourceIds,
      expiresAt: new Date(now.getTime() + (input.days ?? 90) * 86400000).toISOString(),
      revokedAt: null,
      dailyLimit: input.dailyLimit ?? 500,
      usedToday: 0,
      usedOn: now.toISOString().slice(0, 10),
      lastUsedAt: null,
    };
    this.db.credentials.push(record);
    audit(this.db, user.userId, "create_credential", record.id, record.prefix, now.toISOString());
    return { token: token.token, credential: publicCredential(record) };
  }

  listCredentials(actor: Actor) {
    this.requireRole(actor, ["admin"]);
    return this.db.credentials.map(publicCredential);
  }

  revokeCredential(actor: Actor, id: string, now = new Date()) {
    this.requireRole(actor, ["admin"]);
    const credential = this.db.credentials.find((item) => item.id === id);
    if (!credential) throw new AppError(404, "not_found", "Credential not found.");
    credential.revokedAt = now.toISOString();
  }

  authenticateAgent(token: string, now = new Date()): Actor {
    const credential = this.db.credentials.find((item) => tokenMatches(token, item.digest));
    if (!credential || credential.revokedAt || new Date(credential.expiresAt).getTime() <= now.getTime()) {
      throw new AppError(401, "invalid_token", "This agent credential is missing, expired, or revoked.");
    }
    credential.lastUsedAt = now.toISOString();
    return { kind: "agent", credentialId: credential.id, scopes: credential.scopes, sourceIds: credential.sourceIds };
  }

  submitBatch(actor: Actor, raw: unknown, idempotencyKey: string, dryRun: boolean, now = new Date()): BatchResult {
    if (!idempotencyKey.trim()) throw new AppError(400, "idempotency_required", "Send an Idempotency-Key header.");
    const envelope = intakeBatchSchema.safeParse(raw);
    if (!envelope.success) {
      throw new AppError(422, "invalid_batch", "The batch envelope is invalid.", envelope.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })));
    }
    const hash = bodyHash(raw);
    const credential = actor.kind === "agent" ? this.db.credentials.find((item) => item.id === actor.credentialId) : null;
    if (actor.kind === "agent") {
      if (!actor.scopes.includes("jobs:submit")) throw new AppError(403, "insufficient_scope", "This credential cannot submit jobs.");
      if (!credential) throw new AppError(401, "invalid_token", "This agent credential is missing, expired, or revoked.");
    } else {
      this.requireRole(actor, ["admin", "reviewer"]);
    }
    const ownerKey = credential?.id ?? (actor.kind === "user" ? actor.userId : "system");
    const existing = this.db.batches.find((item) => item.idempotencyKey === idempotencyKey && (item.credentialId === credential?.id || item.actorUserId === ownerKey) && !item.dryRun);
    if (!dryRun && existing) {
      if (existing.bodyHash !== hash) throw new AppError(409, "idempotency_conflict", "This Idempotency-Key was already used with a different body.");
      return existing.result;
    }
    if (credential) {
      const day = now.toISOString().slice(0, 10);
      if (credential.usedOn !== day) {
        credential.usedOn = day;
        credential.usedToday = 0;
      }
      if (credential.usedToday + envelope.data.records.length > credential.dailyLimit) {
        throw new AppError(429, "quota_exceeded", "This credential has reached its daily intake limit.");
      }
    }
    const items = envelope.data.records.map((record) => this.intakeRecord(actor, record, dryRun, now));
    const result: BatchResult = { batchId: dryRun ? `dry_${crypto.randomUUID()}` : crypto.randomUUID(), items };
    if (!dryRun) {
      if (credential) credential.usedToday += envelope.data.records.length;
      this.db.batches.push({
        id: result.batchId,
        credentialId: credential?.id ?? null,
        actorUserId: actor.kind === "user" ? actor.userId : null,
        idempotencyKey,
        bodyHash: hash,
        dryRun: false,
        receivedAt: now.toISOString(),
        result,
      });
    }
    return result;
  }

  getBatch(actor: Actor, id: string): BatchResult {
    const batch = this.db.batches.find((item) => item.id === id);
    if (!batch) throw new AppError(404, "not_found", "Batch not found.");
    if (actor.kind === "agent" && batch.credentialId !== actor.credentialId) {
      throw new AppError(403, "insufficient_scope", "You can only read your own batches.");
    }
    if (actor.kind !== "agent") this.requireRole(actor, ["admin", "reviewer"]);
    return batch.result;
  }

  createOrder(actor: Actor, razorpay: { createOrder(input: { amount: number; currency: string; receipt: string }): Promise<{ id: string }> }, now = new Date()): Promise<OrderRecord> {
    const user = this.user(actor);
    if (!this.paymentsOn()) throw new AppError(503, "payments_disabled", "Payments are not open yet.");
    const existing = this.db.orders.find((order) => order.userId === user.userId && order.planId === defaultPlan.id && (order.state === "pending" || order.state === "uncertain") && order.providerOrderId);
    if (existing) return Promise.resolve(existing);
    const attribution = this.db.attributions.find((item) => item.referredUserId === user.userId);
    const order: OrderRecord = {
      id: crypto.randomUUID(),
      userId: user.userId,
      planId: defaultPlan.id,
      productMinor: defaultPlan.priceMinor,
      taxMinor: 0,
      currency: defaultPlan.currency,
      days: defaultPlan.days,
      commissionable: defaultPlan.commissionable,
      rateBps: product.referralRateBps,
      referrerUserId: attribution?.referrerUserId ?? null,
      providerOrderId: null,
      state: "pending",
      createdAt: now.toISOString(),
      refundedProductMinor: 0,
    };
    this.db.orders.push(order);
    return razorpay.createOrder({ amount: order.productMinor + order.taxMinor, currency: order.currency, receipt: order.id }).then(
      (provider) => {
        order.providerOrderId = provider.id;
        return order;
      },
      (error: unknown) => {
        order.state = "uncertain";
        audit(this.db, user.userId, "order_uncertain", order.id, error instanceof Error ? error.name : "provider_error", now.toISOString());
        throw new AppError(503, "provider_uncertain", "The payment order could not be confirmed. Retry before starting another payment.");
      },
    );
  }

  applyProviderEvent(input: {
    providerEventId: string;
    type: string;
    providerOrderId: string;
    providerPaymentId: string;
    amountMinor: number;
    currency: string;
    captured: boolean;
    signatureValid: boolean;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    if (!input.signatureValid) throw new AppError(400, "bad_signature", "The payment signature is not valid.");
    if (this.db.events.some((event) => event.providerEventId === input.providerEventId)) {
      return { duplicate: true as const };
    }
    const order = this.db.orders.find((item) => item.providerOrderId === input.providerOrderId);
    if (!order) throw new AppError(404, "unknown_order", "The payment does not match a Pikajobs order.");
    if (input.captured && input.amountMinor !== order.productMinor + order.taxMinor) {
      throw new AppError(422, "amount_mismatch", "The captured amount does not match the order.");
    }
    if (input.captured && input.currency !== order.currency) {
      throw new AppError(422, "amount_mismatch", "The captured currency does not match the order.");
    }
    this.db.events.push({
      providerEventId: input.providerEventId,
      type: input.type,
      orderId: order.id,
      providerPaymentId: input.providerPaymentId,
      createdAt: now.toISOString(),
    });
    if (!input.captured || (input.type !== "payment.captured" && input.type !== "order.paid")) {
      return { duplicate: false as const, granted: false as const };
    }
    if (this.db.entitlements.some((item) => item.orderId === order.id)) {
      return { duplicate: true as const, granted: false as const };
    }
    const window = entitlementWindow({
      existingEnds: this.db.entitlements.filter((item) => item.userId === order.userId && item.state === "active").map((item) => new Date(item.endsAt)),
      purchaseAt: now,
      days: order.days,
    });
    this.db.entitlements.push({
      id: crypto.randomUUID(),
      userId: order.userId,
      orderId: order.id,
      startsAt: window.startsAt.toISOString(),
      endsAt: window.endsAt.toISOString(),
      state: "active",
    });
    order.state = "paid";
    const economicKey = `v1:${order.id}:${input.providerPaymentId}:earn`;
    if (order.commissionable && order.referrerUserId && !this.db.credits.some((item) => item.economicKey === economicKey)) {
      this.db.credits.push({
        id: crypto.randomUUID(),
        economicKey,
        referrerUserId: order.referrerUserId,
        referredUserId: order.userId,
        orderId: order.id,
        paymentId: input.providerPaymentId,
        currency: order.currency,
        amountMinor: commissionMinor(order.productMinor, order.rateBps),
        reversedMinor: 0,
        reservedMinor: 0,
        paidMinor: 0,
        availableAt: new Date(now.getTime() + product.referralHoldDays * 86400000).toISOString(),
        frozen: false,
        createdAt: now.toISOString(),
      });
    }
    return { duplicate: false as const, granted: true as const };
  }

  applyRefund(input: { refundId: string; providerPaymentId: string; productMinor: number; taxMinor: number; now?: Date }) {
    const now = input.now ?? new Date();
    if (this.db.refundIds.includes(input.refundId)) return { duplicate: true as const };
    const paymentEvent = this.db.events.find((item) => item.providerPaymentId === input.providerPaymentId);
    const order = paymentEvent ? this.db.orders.find((item) => item.id === paymentEvent.orderId) : undefined;
    const credit = this.db.credits.find((item) => item.paymentId === input.providerPaymentId && item.amountMinor > 0);
    if (!order) throw new AppError(404, "unknown_payment", "Refund does not match a payment.");
    if (input.productMinor > order.productMinor - order.refundedProductMinor) {
      throw new AppError(422, "refund_too_large", "The refund exceeds the remaining product amount.");
    }
    this.db.refundIds.push(input.refundId);
    order.refundedProductMinor += input.productMinor;
    if (order.refundedProductMinor >= order.productMinor && input.productMinor > 0) {
      order.state = "refunded";
      for (const entitlement of this.db.entitlements.filter((item) => item.orderId === order.id)) {
        entitlement.state = "revoked";
      }
    }
    const reversal = commissionMinor(input.productMinor, order.rateBps);
    if (credit && reversal > 0) {
      const open = credit.amountMinor - credit.reversedMinor - credit.reservedMinor - credit.paidMinor;
      const fromOpen = Math.min(Math.max(open, 0), reversal);
      credit.reversedMinor += fromOpen;
      const carry = reversal - fromOpen;
      if (carry > 0) {
        const key = `v1:${order.id}:${input.refundId}:carry`;
        if (!this.db.credits.some((item) => item.economicKey === key)) {
          this.db.credits.push({
            ...credit,
            id: crypto.randomUUID(),
            economicKey: key,
            amountMinor: -carry,
            reversedMinor: 0,
            reservedMinor: 0,
            paidMinor: 0,
            availableAt: now.toISOString(),
            frozen: false,
            createdAt: now.toISOString(),
          });
        }
      }
    }
    return { duplicate: false as const };
  }

  acceptReferralTerms(actor: Actor, now = new Date()) {
    const user = this.user(actor);
    if (!user.referralCode) {
      let code = referralCode();
      while (this.db.users.some((item) => item.referralCode === code)) code = referralCode();
      user.referralCode = code;
    }
    user.referralTermsAcceptedAt = now.toISOString();
    return { code: user.referralCode };
  }

  rememberTouch(cookieId: string, code: string, now = new Date()) {
    const referrer = this.db.users.find((user) => user.referralCode === code && user.referralTermsAcceptedAt);
    if (!referrer) return { accepted: false as const };
    const existing = this.db.touches.find((touch) => touch.cookieId === cookieId);
    if (!existing) this.db.touches.push({ cookieId, code, capturedAt: now.toISOString() });
    return { accepted: true as const };
  }

  referralDashboard(actor: Actor, now = new Date()) {
    const user = this.user(actor);
    const credits = this.db.credits.filter((item) => item.referrerUserId === user.userId && item.currency === "INR");
    const signups = this.db.attributions.filter((item) => item.referrerUserId === user.userId).length;
    const purchases = new Set(credits.filter((item) => item.amountMinor > 0).map((item) => item.orderId)).size;
    return {
      code: user.referralCode,
      termsAccepted: Boolean(user.referralTermsAcceptedAt),
      link: user.referralCode ? `/?ref=${user.referralCode}` : null,
      signups,
      purchases,
      balances: balances(credits, now),
      payouts: this.db.payouts.filter((item) => item.userId === user.userId),
    };
  }

  requestPayout(actor: Actor, input: { amountMinor: number; beneficiaryMasked: string }, now = new Date()): PayoutRecord {
    const user = this.user(actor);
    if (input.amountMinor < product.payoutMinimumMinor) {
      throw new AppError(422, "below_minimum", "The minimum payout is INR 500.");
    }
    const credits = this.db.credits.filter((item) => item.referrerUserId === user.userId && item.currency === "INR" && !item.frozen);
    const available = balances(credits, now).available;
    if (available < input.amountMinor) throw new AppError(422, "insufficient_balance", "The available balance is lower than the request.");
    let remaining = input.amountMinor;
    const allocations: { creditId: string; amountMinor: number }[] = [];
    for (const credit of credits) {
      if (remaining <= 0) break;
      const open = credit.amountMinor - credit.reversedMinor - credit.reservedMinor - credit.paidMinor;
      if (new Date(credit.availableAt).getTime() > now.getTime() || open <= 0) continue;
      const take = Math.min(open, remaining);
      credit.reservedMinor += take;
      remaining -= take;
      allocations.push({ creditId: credit.id, amountMinor: take });
    }
    if (remaining !== 0) throw new AppError(409, "reservation_failed", "The balance changed. Try again.");
    const payout: PayoutRecord = {
      id: crypto.randomUUID(),
      userId: user.userId,
      currency: "INR",
      amountMinor: input.amountMinor,
      status: "requested",
      allocations,
      beneficiaryMasked: input.beneficiaryMasked.slice(0, 40),
      evidence: null,
      createdAt: now.toISOString(),
    };
    this.db.payouts.push(payout);
    return payout;
  }

  settlePayout(actor: Actor, input: { payoutId: string; status: PayoutRecord["status"]; evidence?: { reference: string; amountMinor: number; settledAt: string } }, now = new Date()) {
    this.requireRole(actor, ["admin", "finance"]);
    const payout = this.db.payouts.find((item) => item.id === input.payoutId);
    if (!payout) throw new AppError(404, "not_found", "Payout not found.");
    if (payout.status === input.status) return payout;
    if (input.status === "paid") {
      if (!input.evidence?.reference || input.evidence.amountMinor !== payout.amountMinor) {
        throw new AppError(422, "evidence_required", "Record the settled amount, date, and bank reference before marking a payout paid.");
      }
      payout.evidence = input.evidence;
      for (const allocation of payout.allocations) {
        const credit = this.db.credits.find((item) => item.id === allocation.creditId);
        if (!credit) continue;
        credit.reservedMinor -= allocation.amountMinor;
        credit.paidMinor += allocation.amountMinor;
      }
    }
    if (input.status === "failed" || input.status === "rejected") {
      if (payout.status === "paid") throw new AppError(409, "already_paid", "A paid payout cannot be failed. Record a reversal.");
      this.releaseReservation(payout);
    }
    if (input.status === "reversed") {
      if (payout.status !== "paid" || payout.evidence == null) throw new AppError(409, "not_paid", "Only a settled payout can be reversed.");
      for (const allocation of payout.allocations) {
        const credit = this.db.credits.find((item) => item.id === allocation.creditId);
        if (!credit) continue;
        credit.paidMinor -= allocation.amountMinor;
      }
    }
    payout.status = input.status;
    audit(this.db, this.actorId(actor), "payout_status", payout.id, input.status, now.toISOString());
    return payout;
  }

  saveCampaign(actor: Actor, input: { id?: string; name: string; destinationUrl: string; startsAt: string; endsAt: string; active: boolean }, now = new Date()) {
    this.requireRole(actor, ["admin"]);
    assertPublicHttpUrl(input.destinationUrl, "destinationUrl");
    if (isBlockedFetchTarget(input.destinationUrl)) throw new AppError(422, "invalid_url", "That destination is not allowed.");
    const campaign: CampaignRecord = {
      id: input.id ?? crypto.randomUUID(),
      name: plainText(input.name, 80),
      destinationUrl: input.destinationUrl,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      active: input.active,
    };
    this.db.campaigns = this.db.campaigns.filter((item) => item.id !== campaign.id).concat(campaign);
    audit(this.db, this.actorId(actor), "save_campaign", campaign.id, campaign.name, now.toISOString());
    return campaign;
  }

  listCampaigns(actor: Actor) {
    this.requireRole(actor, ["admin"]);
    return this.db.campaigns;
  }

  listAudit(actor: Actor) {
    this.requireRole(actor, ["admin"]);
    return this.db.audit;
  }

  listUsers(actor: Actor) {
    this.requireRole(actor, ["admin"]);
    return this.db.users.map((user) => ({ ...user, roles: [...user.roles] }));
  }

  setFlag(actor: Actor, flag: string, value: boolean, now = new Date()) {
    this.requireRole(actor, ["admin"]);
    if (!(flag in this.db.flags)) throw new AppError(422, "unknown_flag", "Unknown feature flag.");
    this.db.flags[flag] = value;
    audit(this.db, this.actorId(actor), "set_flag", flag, String(value), now.toISOString());
  }

  suspendUser(actor: Actor, userId: string, suspended: boolean, now = new Date()) {
    this.requireRole(actor, ["admin"]);
    const user = this.db.users.find((item) => item.userId === userId);
    if (!user) throw new AppError(404, "not_found", "Account not found.");
    user.suspended = suspended;
    audit(this.db, this.actorId(actor), suspended ? "suspend_user" : "restore_user", userId, user.email, now.toISOString());
  }

  ordersFor(actor: Actor) {
    this.requireRole(actor, ["admin", "finance"]);
    return this.db.orders;
  }

  reports(actor: Actor) {
    this.requireRole(actor, ["admin", "reviewer"]);
    return this.db.reports;
  }

  account(actor: Actor) {
    const user = this.user(actor);
    return { ...user, proUntil: proUntil(this.db, user.userId), preferences: this.prefs(user.userId, new Date()) };
  }

  private paymentsOn(): boolean {
    return Boolean(this.options.paymentsEnabled) && this.db.flags.payments_enabled;
  }

  private attributeNewUser(user: UserAccount, explicitCode: string | null | undefined, cookieId: string | null | undefined, now: Date) {
    const touch = cookieId ? this.db.touches.find((item) => item.cookieId === cookieId) : undefined;
    const code = explicitCode || touch?.code;
    if (touch && now.getTime() - new Date(touch.capturedAt).getTime() > product.attributionWindowDays * 86400000 && !explicitCode) return;
    if (!code) return;
    const referrer = this.db.users.find((item) => item.referralCode === code && item.referralTermsAcceptedAt);
    if (!referrer || referrer.userId === user.userId || referrer.email === user.email) return;
    if (this.db.attributions.some((item) => item.referredUserId === user.userId)) return;
    this.db.attributions.push({ referredUserId: user.userId, referrerUserId: referrer.userId, code, linkedAt: now.toISOString() });
  }

  private intakeRecord(actor: Actor, raw: unknown, dryRun: boolean, now: Date) {
    const parsed = intakeRecordSchema.safeParse(raw);
    const clientReference = parsed.success ? parsed.data.client_reference : clientRefOf(raw);
    if (!parsed.success) {
      return { clientReference, outcome: "rejected" as const, errors: parsed.error.issues.map((issue) => issue.message) };
    }
    const record = parsed.data;
    try {
      assertPublicHttpUrl(record.source_url, "source_url");
      if (record.application.url) assertPublicHttpUrl(record.application.url, "application.url");
    } catch (error) {
      return { clientReference, outcome: "rejected" as const, errors: [error instanceof Error ? error.message : "Invalid URL"] };
    }
    const source = this.db.sources.find((item) => item.id === record.source_id);
    if (!source || !source.enabled) {
      return { clientReference, outcome: "rejected" as const, errors: ["Source is not registered or enabled."] };
    }
    if (actor.kind === "agent" && !actor.sourceIds.includes(source.id)) {
      return { clientReference, outcome: "rejected" as const, errors: ["This credential cannot submit for that source."] };
    }
    if (isBlockedFetchTarget(record.source_url)) {
      return { clientReference, outcome: "rejected" as const, errors: ["Source URL is not allowed."] };
    }
    const existing = this.findBySource(source.id, record.source_job_id ?? null, record.source_url);
    if (existing && (existing.lifecycle === "archived" || existing.lifecycle === "removed")) {
      return { clientReference, outcome: "duplicate" as const, jobId: existing.jobId };
    }
    if (existing) {
      if (!dryRun) {
        this.saveJob(actor.kind === "agent" ? { kind: "system" } : actor, {
          jobId: existing.jobId,
          expectedVersion: existing.version,
          title: record.role_title,
          companyName: record.company_name,
          summary: record.summary,
          opportunityKind: record.opportunity_kind,
          sector: record.sector || existing.sector,
          workMode: record.work_mode,
          roleFamilySlug: record.role_family ?? existing.roleFamilySlug,
          locationLabel: record.location_label,
          locationUnknown: record.location_unknown,
          eligibleCountries: record.eligible_countries,
          skills: record.skills,
          compensationType: existing.compensationType,
          payMinMinor: existing.payMinMinor,
          payMaxMinor: existing.payMaxMinor,
          payCurrency: existing.payCurrency,
          payPeriod: existing.payPeriod,
          payBasis: existing.payBasis,
          applicationMethod: record.application.method,
          applicationUrl: record.application.url,
          hrEmail: record.application.email,
          emailSubject: record.application.subject,
          hrEmailApproved: false,
          sourceId: source.id,
          sourceUrl: record.source_url,
          externalJobId: record.source_job_id,
          sourcePublishedAt: record.source_published_at,
          accessTier: existing.accessTier,
          evidenceExcerpt: record.evidence[0]?.excerpt,
        }, now);
      }
      return { clientReference, outcome: "updated" as const, jobId: existing.jobId };
    }
    const probe = fingerprint([record.company_name, record.role_title, record.location_label ?? ""]);
    const cross = [...this.db.jobsCurrent, ...this.db.drafts].find((job) => fingerprint([job.companyName, job.title, job.locationLabel]) === probe && job.sourceId !== source.id);
    if (!dryRun) {
      const system: Actor = { kind: "system" };
      const saved = this.saveJob(system, {
        title: record.role_title,
        companyName: record.company_name,
        summary: record.summary,
        opportunityKind: record.opportunity_kind,
        sector: record.sector || "not_stated",
        workMode: record.work_mode,
        roleFamilySlug: record.role_family,
        locationLabel: record.location_label,
        locationUnknown: record.location_unknown,
        eligibleCountries: record.eligible_countries,
        skills: record.skills,
        compensationType: "not_disclosed",
        payMinMinor: null,
        payMaxMinor: null,
        applicationMethod: record.application.method,
        applicationUrl: record.application.url,
        hrEmail: record.application.email,
        emailSubject: record.application.subject,
        hrEmailApproved: false,
        sourceId: source.id,
        sourceUrl: record.source_url,
        externalJobId: record.source_job_id,
        sourcePublishedAt: record.source_published_at,
        accessTier: "free",
        evidenceExcerpt: record.evidence[0]?.excerpt,
      }, now);
      saved.lifecycle = "in_review";
      return { clientReference, outcome: cross ? "needs_review" as const : "accepted_for_review" as const, jobId: saved.jobId };
    }
    return { clientReference, outcome: cross ? "needs_review" as const : "accepted_for_review" as const };
  }

  private releaseReservation(payout: PayoutRecord) {
    if (payout.status === "failed" || payout.status === "rejected" || payout.status === "reversed") return;
    for (const allocation of payout.allocations) {
      const credit = this.db.credits.find((item) => item.id === allocation.creditId);
      if (!credit) continue;
      credit.reservedMinor = Math.max(0, credit.reservedMinor - allocation.amountMinor);
    }
  }

  private sponsorId(actor: Actor, now: Date, preview: "free" | "pro" | null): string | null {
    // Ads paused for now — keep campaign storage, do not insert sponsored slots.
    void actor;
    void now;
    void preview;
    return null;
    // if (!this.db.flags.ads_enabled) return null;
    // if (preview === "pro") return null;
    // if (actor.kind === "user" && canReadTier(actor, "pro", now, null) && proActive(actor, now)) return null;
    // const campaign = this.db.campaigns.find((item) => item.active && new Date(item.startsAt) <= now && new Date(item.endsAt) > now);
    // return campaign?.id ?? null;
  }

  private assertReadable(actor: Actor, jobId: string, now: Date): JobRecord {
    const view = this.getJob(actor, jobId, now);
    if (view.status !== "ok") throw new AppError(404, "not_available", "This listing is not available.");
    const job = this.db.jobsCurrent.find((item) => item.jobId === jobId);
    if (!job) throw new AppError(404, "not_available", "This listing is not available.");
    return job;
  }

  private user(actor: Actor): UserAccount {
    if (actor.kind !== "user") throw new AppError(401, "sign_in_required", "Sign in to continue.");
    const user = this.db.users.find((item) => item.userId === actor.userId && !item.deletedAt);
    if (!user) throw new AppError(401, "sign_in_required", "Sign in to continue.");
    if (user.suspended || actor.suspended) throw new AppError(403, "suspended", "This account is suspended.");
    return user;
  }

  private requireRole(actor: Actor, roles: string[]): UserAccount {
    const user = this.user(actor);
    if (!roles.some((role) => user.roles.includes(role))) throw new AppError(403, "forbidden", "You do not have access to this area.");
    return user;
  }

  private actorId(actor: Actor): string {
    if (actor.kind === "user") return actor.userId;
    if (actor.kind === "agent") return actor.credentialId;
    return actor.kind;
  }

  private prefs(userId: string, now: Date): Preferences {
    const found = this.db.preferences.find((item) => item.userId === userId);
    if (found) return found;
    const created = emptyPreferences(userId, now.toISOString());
    this.db.preferences.push(created);
    return created;
  }

  private company(name: string) {
    const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
    const existing = this.db.companies.find((item) => item.normalizedName === normalized);
    if (existing) return existing;
    const created = { id: crypto.randomUUID(), normalizedName: normalized, displayName: name.trim() };
    this.db.companies.push(created);
    return created;
  }

  private findAny(jobId: string): JobRecord | undefined {
    return this.db.jobsCurrent.find((item) => item.jobId === jobId) ?? this.db.drafts.find((item) => item.jobId === jobId) ?? this.db.jobsArchive.find((item) => item.jobId === jobId);
  }

  private findBySource(sourceId: string, externalJobId: string | null, sourceUrl: string): JobRecord | undefined {
    const jobs = [...this.db.jobsCurrent, ...this.db.drafts, ...this.db.jobsArchive];
    if (externalJobId) {
      const byExternal = jobs.find((job) => job.sourceId === sourceId && job.externalJobId === externalJobId);
      if (byExternal) return byExternal;
    }
    const normalized = sourceUrl.trim().replace(/\/$/, "").toLowerCase();
    return jobs.find((job) => job.sourceId === sourceId && job.sourceUrl.trim().replace(/\/$/, "").toLowerCase() === normalized);
  }

  private crossSourceDuplicate(job: JobRecord): boolean {
    const key = fingerprint([job.companyName, job.title, job.locationLabel]);
    return [...this.db.jobsCurrent, ...this.db.drafts].some((item) => item.jobId !== job.jobId && item.sourceId !== job.sourceId && fingerprint([item.companyName, item.title, item.locationLabel]) === key);
  }

  private replaceJob(record: JobRecord) {
    this.db.jobsCurrent = this.db.jobsCurrent.filter((item) => item.jobId !== record.jobId);
    this.db.jobsArchive = this.db.jobsArchive.filter((item) => item.jobId !== record.jobId);
    this.db.drafts = this.db.drafts.filter((item) => item.jobId !== record.jobId);
    if (record.lifecycle === "published") this.db.jobsCurrent.push(record);
    else if (record.lifecycle === "archived" || record.lifecycle === "removed") this.db.jobsArchive.push(record);
    else this.db.drafts.push(record);
    this.assertLocations();
  }

  private moveToArchive(job: JobRecord, reason: string, now: Date) {
    if (this.db.jobsArchive.some((item) => item.jobId === job.jobId)) return;
    const archived: JobRecord = { ...job, lifecycle: job.lifecycle === "removed" ? "removed" : "archived", archiveReason: reason, archivedAt: now.toISOString() };
    this.db.jobsArchive.push(archived);
    this.db.jobsCurrent = this.db.jobsCurrent.filter((item) => item.jobId !== job.jobId);
    this.db.drafts = this.db.drafts.filter((item) => item.jobId !== job.jobId);
  }

  private assertLocations() {
    const ids = [...this.db.jobsCurrent, ...this.db.jobsArchive, ...this.db.drafts].map((job) => job.jobId);
    if (new Set(ids).size !== ids.length) throw new Error("A job payload exists in more than one store.");
  }
}

function publicCredential(record: CredentialRecord) {
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

function toCard(job: JobRecord, reasons: string[], saved = false): JobCard {
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
    eligibility: (job.eligibility ?? []).slice(0, 6),
    responsibilities: (job.responsibilities ?? []).slice(0, 8),
    batchLabel: job.batchLabel ?? null,
    durationLabel: job.durationLabel ?? null,
    originalSourceLabel: job.originalSourceLabel ?? null,
    applyNote: job.applyNote ?? null,
    summary: job.summary,
    effectiveJobAt: job.effectiveJobAt,
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

function compareRanked(a: { job: JobRecord; score: number }, b: { job: JobRecord; score: number }): number {
  if (b.score !== a.score) return b.score - a.score;
  return compareLatest(a.job, b.job);
}

function afterCursor(item: { job: JobRecord; score: number }, cursor: Cursor, sort: "latest" | "for_you"): boolean {
  if (sort === "latest") return compareLatest(item.job, { ...item.job, jobId: cursor.id, effectiveJobAt: cursor.at }) > 0;
  if (item.score !== cursor.score) return item.score < (cursor.score ?? 0);
  return compareLatest(item.job, { ...item.job, jobId: cursor.id, effectiveJobAt: cursor.at }) > 0;
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value: string): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Cursor;
    if (!parsed.at || !parsed.id || !parsed.asOf || (parsed.sort !== "latest" && parsed.sort !== "for_you")) {
      throw new Error("bad");
    }
    return parsed;
  } catch {
    throw new AppError(400, "bad_cursor", "That feed page token is not valid.");
  }
}

function clientRefOf(raw: unknown): string {
  if (raw && typeof raw === "object" && "client_reference" in raw && typeof raw.client_reference === "string") return raw.client_reference;
  return "unknown";
}

function proActive(actor: Actor, now: Date): boolean {
  return actor.kind === "user" && actor.proUntil != null && new Date(actor.proUntil).getTime() > now.getTime();
}

export function encryptSecret(value: string, secret: string): string {
  const iv = randomBytes(12);
  const key = createHash("sha256").update(secret).digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export { createDatabase };
