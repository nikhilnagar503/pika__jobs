/** Agent credentials and batch job intake. */
import { intakeBatchSchema, intakeRecordSchema } from "@/shared/job-intake";
import { fingerprint, generateAgentToken, tokenMatches } from "@/domain/money";
import { assertPublicHttpUrl, isBlockedFetchTarget } from "@/domain/safety";
import type { Actor } from "@/domain/types";
import { AppError } from "@/http";
import { audit, bodyHash, type BatchResult, type CredentialRecord } from "@/repositories/db";
import { clientRefOf, publicCredential } from "@/repositories/store/helpers";


import type { StoreCore } from "@/repositories/store/store-core";

type Ctor<T = StoreCore> = new (...args: any[]) => T;

export function WithAgents<TBase extends Ctor>(Base: TBase) {
  return class extends Base {
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

  protected intakeRecord(actor: Actor, raw: unknown, dryRun: boolean, now: Date) {
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
  };
}
