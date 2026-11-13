/**
 * Shared store foundation: database handle + common lookups/auth helpers.
 * Domain modules (users/feed/jobs/admin/...) build on this.
 */
import { fingerprint } from "@/domain/money";
import { canReadTier, type Actor, type JobRecord, type Preferences, type UserAccount } from "@/domain/types";
import { AppError } from "@/http";
import {
  createDatabase,
  emptyPreferences,
  type Database,
} from "@/repositories/db";

export type StoreOptions = { sessionSecret?: string };

export class StoreCore {
  constructor(
    readonly db: Database = createDatabase(),
    protected readonly options: StoreOptions = {},
  ) {}

  protected user(actor: Actor): UserAccount {
    if (actor.kind !== "user") throw new AppError(401, "sign_in_required", "Sign in to continue.");
    const user = this.db.users.find((item) => item.userId === actor.userId && !item.deletedAt);
    if (!user) throw new AppError(401, "sign_in_required", "Sign in to continue.");
    if (user.suspended || actor.suspended) throw new AppError(403, "suspended", "This account is suspended.");
    return user;
  }
  protected requireRole(actor: Actor, roles: string[]): UserAccount {
    const user = this.user(actor);
    if (!roles.some((role) => user.roles.includes(role))) throw new AppError(403, "forbidden", "You do not have access to this area.");
    return user;
  }
  protected actorId(actor: Actor): string {
    if (actor.kind === "user") return actor.userId;
    if (actor.kind === "agent") return actor.credentialId;
    return actor.kind;
  }
  protected prefs(userId: string, now: Date): Preferences {
    const found = this.db.preferences.find((item) => item.userId === userId);
    if (found) return found;
    const created = emptyPreferences(userId, now.toISOString());
    this.db.preferences.push(created);
    return created;
  }
  protected company(name: string) {
    const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
    const existing = this.db.companies.find((item) => item.normalizedName === normalized);
    if (existing) return existing;
    const created = { id: crypto.randomUUID(), normalizedName: normalized, displayName: name.trim() };
    this.db.companies.push(created);
    return created;
  }
  protected findAny(jobId: string): JobRecord | undefined {
    return this.db.jobsCurrent.find((item) => item.jobId === jobId) ?? this.db.drafts.find((item) => item.jobId === jobId) ?? this.db.jobsArchive.find((item) => item.jobId === jobId);
  }
  protected findBySource(sourceId: string, externalJobId: string | null, sourceUrl: string): JobRecord | undefined {
    // Prefer live/draft matches. Archive is only a fallback and is ignored by saveJob for fresh imports.
    const live = [...this.db.jobsCurrent, ...this.db.drafts];
    const all = [...live, ...this.db.jobsArchive];
    if (externalJobId) {
      const byExternalLive = live.find((job) => job.sourceId === sourceId && job.externalJobId === externalJobId);
      if (byExternalLive) return byExternalLive;
      const byExternal = all.find((job) => job.sourceId === sourceId && job.externalJobId === externalJobId);
      if (byExternal) return byExternal;
    }
    const normalized = sourceUrl.trim().replace(/\/$/, "").toLowerCase();
    const placeholder =
      !normalized ||
      normalized === "https://pikajobs.com" ||
      normalized.startsWith("https://pikajobs.com/import/");
    if (placeholder) {
      return undefined;
    }
    const byUrlLive = live.find(
      (job) => job.sourceId === sourceId && job.sourceUrl.trim().replace(/\/$/, "").toLowerCase() === normalized,
    );
    if (byUrlLive) return byUrlLive;
    return all.find(
      (job) => job.sourceId === sourceId && job.sourceUrl.trim().replace(/\/$/, "").toLowerCase() === normalized,
    );
  }
  findLiveCompanyTitleDuplicate(companyName: string, title: string, excludeJobId?: string): JobRecord | null {
    const key = fingerprint([companyName, title]);
    const live = [...this.db.jobsCurrent, ...this.db.drafts];
    return (
      live.find(
        (item) =>
          item.jobId !== excludeJobId &&
          item.lifecycle !== "archived" &&
          item.lifecycle !== "removed" &&
          fingerprint([item.companyName, item.title]) === key,
      ) ?? null
    );
  }
  findLiveExternalJob(sourceId: string, externalJobId: string | null | undefined): JobRecord | null {
    if (!externalJobId) return null;
    return (
      [...this.db.jobsCurrent, ...this.db.drafts].find(
        (item) =>
          item.sourceId === sourceId &&
          item.externalJobId === externalJobId &&
          item.lifecycle !== "archived" &&
          item.lifecycle !== "removed",
      ) ?? null
    );
  }
  protected crossSourceDuplicate(job: JobRecord): boolean {
    const key = fingerprint([job.companyName, job.title, job.locationLabel]);
    return [...this.db.jobsCurrent, ...this.db.drafts].some((item) => item.jobId !== job.jobId && item.sourceId !== job.sourceId && fingerprint([item.companyName, item.title, item.locationLabel]) === key);
  }
  protected replaceJob(record: JobRecord) {
    this.db.jobsCurrent = this.db.jobsCurrent.filter((item) => item.jobId !== record.jobId);
    this.db.jobsArchive = this.db.jobsArchive.filter((item) => item.jobId !== record.jobId);
    this.db.drafts = this.db.drafts.filter((item) => item.jobId !== record.jobId);
    if (record.lifecycle === "published") this.db.jobsCurrent.push(record);
    else if (record.lifecycle === "archived" || record.lifecycle === "removed") this.db.jobsArchive.push(record);
    else this.db.drafts.push(record);
    this.assertLocations();
  }
  protected moveToArchive(job: JobRecord, reason: string, now: Date) {
    if (this.db.jobsArchive.some((item) => item.jobId === job.jobId)) return;
    const archived: JobRecord = { ...job, lifecycle: job.lifecycle === "removed" ? "removed" : "archived", archiveReason: reason, archivedAt: now.toISOString() };
    this.db.jobsArchive.push(archived);
    this.db.jobsCurrent = this.db.jobsCurrent.filter((item) => item.jobId !== job.jobId);
    this.db.drafts = this.db.drafts.filter((item) => item.jobId !== job.jobId);
  }
  protected assertLocations() {
    const ids = [...this.db.jobsCurrent, ...this.db.jobsArchive, ...this.db.drafts].map((job) => job.jobId);
    if (new Set(ids).size !== ids.length) throw new Error("A job payload exists in more than one store.");
  }
}
