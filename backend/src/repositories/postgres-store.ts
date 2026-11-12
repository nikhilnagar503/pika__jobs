import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { JobRecord, Preferences, UserAccount } from "@/domain/types";
import {
  createDatabase,
  type BatchRecord,
  type CredentialRecord,
  type Database,
  type SourceRecord,
} from "@/repositories/db";

const PAGE = 1000;
const CHUNK = 200;

function serviceUrl(): string {
  return (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
}

function serviceKey(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

export function postgresConfigured(): boolean {
  if (process.env.PIKAJOBS_DATA_MODE === "file") return false;
  if (process.env.PIKAJOBS_DATA_MODE === "supabase") return Boolean(serviceUrl() && serviceKey());
  return Boolean(serviceUrl() && serviceKey());
}

function client(): SupabaseClient {
  return createClient(serviceUrl(), serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function selectAll<T>(table: string): Promise<T[]> {
  const db = client();
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select("*").range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

async function replaceAll(table: string, pk: string, rows: Record<string, unknown>[]): Promise<void> {
  const db = client();
  const { error: delError } = await db.from(table).delete().neq(pk, "__none__");
  if (delError) throw new Error(`delete ${table}: ${delError.message}`);
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    if (!slice.length) continue;
    const { error } = await db.from(table).insert(slice);
    if (error) throw new Error(`insert ${table}: ${error.message}`);
  }
}

function asIso(value: unknown): string {
  if (!value) return new Date().toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function asIsoOrNull(value: unknown): string | null {
  if (value == null || value === "") return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function strs(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function memberFromRow(row: Record<string, unknown>): UserAccount {
  return {
    userId: String(row.user_id),
    email: String(row.email ?? ""),
    displayName: String(row.display_name ?? ""),
    countryCode: String(row.country_code ?? "IN"),
    currentStage: String(row.current_stage ?? ""),
    onboardingStep: Number(row.onboarding_step ?? 0),
    onboardingCompleted: Boolean(row.onboarding_completed),
    adultConfirmed: Boolean(row.adult_confirmed),
    roles: strs(row.roles),
    suspended: Boolean(row.suspended),
    createdAt: asIso(row.created_at),
    deletedAt: asIsoOrNull(row.deleted_at),
  };
}

function prefsFromRow(row: Record<string, unknown>): Preferences {
  return {
    userId: String(row.user_id),
    opportunityKinds: strs(row.opportunity_kinds),
    sectors: strs(row.sectors),
    roleFamilySlugs: strs(row.role_family_slugs),
    skillSlugs: strs(row.skill_slugs),
    workModes: strs(row.work_modes),
    locationLabel: String(row.location_label ?? ""),
    countryCode: String(row.country_code ?? "IN"),
    experienceBand: String(row.experience_band ?? ""),
    stage: String(row.stage ?? ""),
    showUnknownPay: row.show_unknown_pay !== false,
    jobPayTargetMinor: row.job_pay_target_minor == null ? null : Number(row.job_pay_target_minor),
    internshipPayTargetMinor: row.internship_pay_target_minor == null ? null : Number(row.internship_pay_target_minor),
    otherRoleNote: String(row.other_role_note ?? ""),
    updatedAt: asIso(row.updated_at),
  };
}

function jobFromRow(row: Record<string, unknown>): JobRecord {
  const method = row.application_method === "email" || row.application_method === "both" ? row.application_method : "url";
  const lifecycle = ["draft", "in_review", "published", "archived", "removed", "closed"].includes(String(row.lifecycle))
    ? (row.lifecycle as JobRecord["lifecycle"])
    : "draft";
  return {
    jobId: String(row.job_id),
    version: Number(row.version ?? 1),
    title: String(row.title ?? ""),
    companyName: String(row.company_name ?? ""),
    companyId: String(row.company_id ?? ""),
    summary: String(row.summary ?? ""),
    opportunityKind: String(row.opportunity_kind ?? "job"),
    employmentArrangement: String(row.employment_arrangement ?? ""),
    sector: String(row.sector ?? ""),
    workMode: String(row.work_mode ?? ""),
    seniority: String(row.seniority ?? ""),
    roleFamilySlug: row.role_family_slug == null ? null : String(row.role_family_slug),
    industrySlug: row.industry_slug == null ? null : String(row.industry_slug),
    locationLabel: String(row.location_label ?? ""),
    locationUnknown: Boolean(row.location_unknown),
    countryCode: row.country_code == null ? null : String(row.country_code),
    eligibleCountries: strs(row.eligible_countries),
    skills: strs(row.skills),
    requirements: strs(row.requirements),
    eligibility: strs(row.eligibility),
    responsibilities: strs(row.responsibilities),
    batchLabel: row.batch_label == null ? null : String(row.batch_label),
    durationLabel: row.duration_label == null ? null : String(row.duration_label),
    originalSourceLabel: row.original_source_label == null ? null : String(row.original_source_label),
    payDisplayLabel: row.pay_display_label == null ? null : String(row.pay_display_label),
    applyNote: row.apply_note == null ? null : String(row.apply_note),
    compensationType: String(row.compensation_type ?? "not_disclosed"),
    payMinMinor: row.pay_min_minor == null ? null : Number(row.pay_min_minor),
    payMaxMinor: row.pay_max_minor == null ? null : Number(row.pay_max_minor),
    payCurrency: row.pay_currency == null ? null : String(row.pay_currency),
    payPeriod: row.pay_period == null ? null : String(row.pay_period),
    payBasis: row.pay_basis == null ? null : String(row.pay_basis),
    applicationMethod: method,
    applicationUrl: row.application_url == null ? null : String(row.application_url),
    hrEmail: row.hr_email == null ? null : String(row.hr_email),
    emailSubject: row.email_subject == null ? null : String(row.email_subject),
    hrEmailApproved: Boolean(row.hr_email_approved),
    sourceId: String(row.source_id ?? ""),
    sourceUrl: String(row.source_url ?? ""),
    externalJobId: row.external_job_id == null ? null : String(row.external_job_id),
    sourcePublishedAt: asIsoOrNull(row.source_published_at),
    datePrecision: row.date_precision === "date" ? "date" : "instant",
    firstSeenAt: asIso(row.first_seen_at),
    effectiveJobAt: asIso(row.effective_job_at),
    visibleUntil: asIso(row.visible_until),
    publishedAt: asIsoOrNull(row.published_at),
    lastCheckedAt: asIsoOrNull(row.last_checked_at),
    deadlineAt: asIsoOrNull(row.deadline_at),
    accessTier: row.access_tier === "pro" ? "pro" : "free",
    verification: String(row.verification ?? "unreviewed"),
    lifecycle,
    government: (row.government as Record<string, string> | null) ?? null,
    evidence: Array.isArray(row.evidence) ? (row.evidence as JobRecord["evidence"]) : [],
    archiveReason: row.archive_reason == null ? undefined : String(row.archive_reason),
    archivedAt: asIsoOrNull(row.archived_at) ?? undefined,
  };
}

function jobRow(job: JobRecord, bucket: "draft" | "current" | "archive"): Record<string, unknown> {
  return {
    job_id: job.jobId,
    bucket,
    version: job.version,
    title: job.title,
    company_name: job.companyName,
    company_id: job.companyId,
    summary: job.summary,
    opportunity_kind: job.opportunityKind,
    employment_arrangement: job.employmentArrangement,
    sector: job.sector,
    work_mode: job.workMode,
    seniority: job.seniority,
    role_family_slug: job.roleFamilySlug,
    industry_slug: job.industrySlug,
    location_label: job.locationLabel,
    location_unknown: job.locationUnknown,
    country_code: job.countryCode,
    eligible_countries: job.eligibleCountries,
    skills: job.skills,
    requirements: job.requirements,
    eligibility: job.eligibility,
    responsibilities: job.responsibilities,
    batch_label: job.batchLabel,
    duration_label: job.durationLabel,
    original_source_label: job.originalSourceLabel,
    pay_display_label: job.payDisplayLabel,
    apply_note: job.applyNote,
    compensation_type: job.compensationType,
    pay_min_minor: job.payMinMinor,
    pay_max_minor: job.payMaxMinor,
    pay_currency: job.payCurrency,
    pay_period: job.payPeriod,
    pay_basis: job.payBasis,
    application_method: job.applicationMethod,
    application_url: job.applicationUrl,
    hr_email: job.hrEmail,
    email_subject: job.emailSubject,
    hr_email_approved: job.hrEmailApproved,
    source_id: job.sourceId,
    source_url: job.sourceUrl,
    external_job_id: job.externalJobId,
    source_published_at: job.sourcePublishedAt,
    date_precision: job.datePrecision,
    first_seen_at: job.firstSeenAt,
    effective_job_at: job.effectiveJobAt,
    visible_until: job.visibleUntil,
    published_at: job.publishedAt,
    last_checked_at: job.lastCheckedAt,
    deadline_at: job.deadlineAt,
    access_tier: job.accessTier,
    verification: job.verification,
    lifecycle: job.lifecycle,
    government: job.government,
    evidence: job.evidence ?? [],
    archive_reason: job.archiveReason ?? null,
    archived_at: job.archivedAt ?? null,
  };
}

export async function loadPostgresDatabase(): Promise<Database> {
  const db = createDatabase();
  const [
    members,
    prefs,
    companies,
    sources,
    jobs,
    versions,
    credentials,
    batches,
    saved,
    applications,
    audit,
    flags,
    stateRows,
  ] = await Promise.all([
    selectAll<Record<string, unknown>>("members"),
    selectAll<Record<string, unknown>>("member_preferences"),
    selectAll<Record<string, unknown>>("companies"),
    selectAll<Record<string, unknown>>("sources"),
    selectAll<Record<string, unknown>>("jobs"),
    selectAll<Record<string, unknown>>("job_versions"),
    selectAll<Record<string, unknown>>("agent_credentials"),
    selectAll<Record<string, unknown>>("intake_batches"),
    selectAll<Record<string, unknown>>("saved_jobs"),
    selectAll<Record<string, unknown>>("application_events"),
    selectAll<Record<string, unknown>>("audit_events"),
    selectAll<Record<string, unknown>>("app_flags"),
    selectAll<Record<string, unknown>>("app_state"),
  ]);

  db.users = members.map(memberFromRow);
  db.preferences = prefs.map(prefsFromRow);
  db.companies = companies.map((row) => ({
    id: String(row.id),
    normalizedName: String(row.normalized_name ?? ""),
    displayName: String(row.display_name ?? ""),
  }));
  db.sources = sources.map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    type: String(row.type ?? ""),
    canonicalDomain: String(row.canonical_domain ?? ""),
    permissionBasis: String(row.permission_basis ?? ""),
    enabled: Boolean(row.enabled),
    boardId: String(row.board_id ?? ""),
    lastSuccessAt: asIsoOrNull(row.last_success_at),
  })) as SourceRecord[];
  db.drafts = jobs.filter((row) => row.bucket === "draft").map(jobFromRow);
  db.jobsCurrent = jobs.filter((row) => row.bucket === "current").map(jobFromRow);
  db.jobsArchive = jobs.filter((row) => row.bucket === "archive").map(jobFromRow);
  db.versions = versions.map((row) => ({
    jobId: String(row.job_id),
    version: Number(row.version ?? 1),
    summary: String(row.summary ?? ""),
    actorId: String(row.actor_id ?? ""),
    at: asIso(row.at),
  }));
  db.credentials = credentials.map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    ownerId: String(row.owner_id ?? ""),
    prefix: String(row.prefix ?? ""),
    digest: String(row.digest ?? ""),
    scopes: strs(row.scopes),
    sourceIds: strs(row.source_ids),
    expiresAt: asIso(row.expires_at),
    revokedAt: asIsoOrNull(row.revoked_at),
    dailyLimit: Number(row.daily_limit ?? 0),
    usedToday: Number(row.used_today ?? 0),
    usedOn: String(row.used_on ?? ""),
    lastUsedAt: asIsoOrNull(row.last_used_at),
  })) as CredentialRecord[];
  db.batches = batches.map((row) => ({
    id: String(row.id),
    credentialId: row.credential_id == null ? null : String(row.credential_id),
    actorUserId: row.actor_user_id == null ? null : String(row.actor_user_id),
    idempotencyKey: String(row.idempotency_key ?? ""),
    bodyHash: String(row.body_hash ?? ""),
    dryRun: Boolean(row.dry_run),
    receivedAt: asIso(row.received_at),
    result: (row.result ?? { batchId: String(row.id), items: [] }) as BatchRecord["result"],
  }));
  db.saved = saved.map((row) => ({
    userId: String(row.user_id),
    jobId: String(row.job_id),
    createdAt: asIso(row.created_at),
  }));
  db.applications = applications.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    jobId: String(row.job_id),
    kind: row.kind === "applied" ? "applied" : "opened",
    occurredAt: asIso(row.occurred_at),
  }));
  db.audit = audit.map((row) => ({
    id: String(row.id),
    actorId: String(row.actor_id),
    action: String(row.action),
    objectId: String(row.object_id),
    at: asIso(row.at),
    summary: String(row.summary ?? ""),
  }));
  db.flags = { publication_paused: false };
  for (const row of flags) db.flags[String(row.key)] = Boolean(row.value);
  const state = stateRows[0];
  if (state) {
    db.demoSeedVersion = String(state.demo_seed_version ?? "");
    db.bootstrapConsumed = Boolean(state.bootstrap_consumed);
  }
  return db;
}

export function postgresLooksEmpty(db: Database): boolean {
  return db.jobsCurrent.length === 0 && db.drafts.length === 0 && db.jobsArchive.length === 0 && db.users.length === 0;
}

export async function savePostgresDatabase(db: Database): Promise<void> {
  await replaceAll(
    "member_preferences",
    "user_id",
    [],
  );
  await replaceAll(
    "members",
    "user_id",
    db.users.map((user) => ({
      user_id: user.userId,
      email: user.email,
      display_name: user.displayName,
      country_code: user.countryCode,
      current_stage: user.currentStage,
      onboarding_step: user.onboardingStep,
      onboarding_completed: user.onboardingCompleted,
      adult_confirmed: user.adultConfirmed,
      roles: user.roles,
      suspended: user.suspended,
      created_at: user.createdAt,
      deleted_at: user.deletedAt,
    })),
  );
  await replaceAll(
    "member_preferences",
    "user_id",
    db.preferences.map((prefs) => ({
      user_id: prefs.userId,
      opportunity_kinds: prefs.opportunityKinds,
      sectors: prefs.sectors,
      role_family_slugs: prefs.roleFamilySlugs,
      skill_slugs: prefs.skillSlugs,
      work_modes: prefs.workModes,
      location_label: prefs.locationLabel,
      country_code: prefs.countryCode,
      experience_band: prefs.experienceBand,
      stage: prefs.stage,
      show_unknown_pay: prefs.showUnknownPay,
      job_pay_target_minor: prefs.jobPayTargetMinor,
      internship_pay_target_minor: prefs.internshipPayTargetMinor,
      other_role_note: prefs.otherRoleNote,
      updated_at: prefs.updatedAt,
    })),
  );
  await replaceAll(
    "companies",
    "id",
    db.companies.map((company) => ({
      id: company.id,
      normalized_name: company.normalizedName,
      display_name: company.displayName,
    })),
  );
  await replaceAll(
    "sources",
    "id",
    db.sources.map((source) => ({
      id: source.id,
      name: source.name,
      type: source.type,
      canonical_domain: source.canonicalDomain,
      permission_basis: source.permissionBasis,
      enabled: source.enabled,
      board_id: source.boardId,
      last_success_at: source.lastSuccessAt,
    })),
  );
  await replaceAll("jobs", "job_id", [
    ...db.drafts.map((job) => jobRow(job, "draft")),
    ...db.jobsCurrent.map((job) => jobRow(job, "current")),
    ...db.jobsArchive.map((job) => jobRow(job, "archive")),
  ]);
  await replaceAll(
    "job_versions",
    "job_id",
    db.versions.map((item) => ({
      job_id: item.jobId,
      version: item.version,
      summary: item.summary,
      actor_id: item.actorId,
      at: item.at,
    })),
  );
  await replaceAll(
    "agent_credentials",
    "id",
    db.credentials.map((item) => ({
      id: item.id,
      name: item.name,
      owner_id: item.ownerId,
      prefix: item.prefix,
      digest: item.digest,
      scopes: item.scopes,
      source_ids: item.sourceIds,
      expires_at: item.expiresAt,
      revoked_at: item.revokedAt,
      daily_limit: item.dailyLimit,
      used_today: item.usedToday,
      used_on: item.usedOn,
      last_used_at: item.lastUsedAt,
    })),
  );
  await replaceAll(
    "intake_batches",
    "id",
    db.batches.map((item) => ({
      id: item.id,
      credential_id: item.credentialId,
      actor_user_id: item.actorUserId,
      idempotency_key: item.idempotencyKey,
      body_hash: item.bodyHash,
      dry_run: item.dryRun,
      received_at: item.receivedAt,
      result: item.result,
    })),
  );
  await replaceAll(
    "saved_jobs",
    "user_id",
    db.saved.map((item) => ({
      user_id: item.userId,
      job_id: item.jobId,
      created_at: item.createdAt,
    })),
  );
  await replaceAll(
    "application_events",
    "id",
    db.applications.map((item) => ({
      id: item.id,
      user_id: item.userId,
      job_id: item.jobId,
      kind: item.kind,
      occurred_at: item.occurredAt,
    })),
  );
  await replaceAll(
    "audit_events",
    "id",
    db.audit.map((item) => ({
      id: item.id,
      actor_id: item.actorId,
      action: item.action,
      object_id: item.objectId,
      summary: item.summary,
      at: item.at,
    })),
  );
  await replaceAll(
    "app_flags",
    "key",
    Object.entries(db.flags).map(([key, value]) => ({ key, value })),
  );
  const dbClient = client();
  const { error } = await dbClient.from("app_state").upsert({
    id: 1,
    demo_seed_version: db.demoSeedVersion,
    bootstrap_consumed: db.bootstrapConsumed,
  });
  if (error) throw new Error(`app_state: ${error.message}`);
}
