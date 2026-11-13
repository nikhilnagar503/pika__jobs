/** Create, publish, archive, and delete job listings. */
import {
  computeVisibleUntil,
  publicationBlockReason,
  resolveEffectiveJobAt,
} from "@/domain/jobs/visibility";
import { validatePay } from "@/domain/jobs/pay";
import { assertPublicHttpUrl, plainText } from "@/domain/safety";
import type { Actor, JobRecord } from "@/domain/types";
import { AppError } from "@/http";
import { audit } from "@/repositories/db";
import type { JobInput } from "@/repositories/store/types";


import type { StoreCore } from "@/repositories/store/store-core";

type Ctor<T = StoreCore> = new (...args: any[]) => T;

export function WithJobs<TBase extends Ctor>(Base: TBase) {
  return class extends Base {
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
    let existing = input.jobId
      ? this.findAny(input.jobId)
      : this.findBySource(input.sourceId, input.externalJobId ?? null, input.sourceUrl);
    // Deleted/expired archive rows must not block a fresh import of the same external id.
    if (existing && (existing.lifecycle === "archived" || existing.lifecycle === "removed")) {
      if (input.jobId) {
        throw new AppError(409, "archived", "Archived listings stay archived. A new posting needs a new identity.");
      }
      existing = undefined;
    }
    if (existing && input.expectedVersion == null) {
      throw new AppError(409, "version_required", "Send the listing version you edited.");
    }
    if (existing && input.expectedVersion != null && existing.version !== input.expectedVersion) {
      throw new AppError(409, "version_conflict", "This listing was updated. Reload it and try again.");
    }
    const duplicate = this.findLiveCompanyTitleDuplicate(input.companyName, input.title, existing?.jobId);
    if (duplicate) {
      throw new AppError(
        409,
        "duplicate_listing",
        `A live listing already exists for ${duplicate.companyName} · ${duplicate.title}.`,
      );
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
      eligibility: (input.eligibility ?? []).map((item) => plainText(item, 220)).slice(0, 8),
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
    if ((job.applicationMethod === "url" || job.applicationMethod === "both") && !job.applicationUrl && !job.applyNote) {
      throw new AppError(422, "application_required", "Add an application link or contact/walk-in note.");
    }
    if (job.hrEmail) job.hrEmailApproved = true;
    if ((job.applicationMethod === "email" || job.applicationMethod === "both") && !job.hrEmail) {
      throw new AppError(422, "email_not_approved", "Add an HR email before publishing an email listing.");
    }
    const block = publicationBlockReason(new Date(job.effectiveJobAt), new Date(job.visibleUntil), now);
    if (block) throw new AppError(422, "not_publishable", block);
    const titleDuplicate = this.findLiveCompanyTitleDuplicate(job.companyName, job.title, job.jobId);
    if (titleDuplicate) {
      throw new AppError(
        409,
        "duplicate_listing",
        `A live listing already exists for ${titleDuplicate.companyName} · ${titleDuplicate.title}.`,
      );
    }
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
    const draft = this.db.drafts.find((item) => item.jobId === jobId);
    const target = current ?? draft;
    if (!target) throw new AppError(404, "not_available", "This listing is not available to remove.");
    target.lifecycle = reason === "Deleted by admin" || reason === "safety_removal" ? "removed" : "archived";
    target.visibleUntil = now.toISOString();
    this.moveToArchive(target, reason, now);
    audit(this.db, this.actorId(actor), "archive_job", jobId, reason, now.toISOString());
    return { jobId, lifecycle: target.lifecycle };
  }

  deleteJob(actor: Actor, jobId: string, now = new Date()) {
    return this.archiveJob(actor, jobId, "Deleted by admin", now);
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
  };
}
