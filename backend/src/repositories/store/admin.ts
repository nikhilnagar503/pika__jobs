/** Admin sources, overview, users, and flags. */
import { isVisibleAt, listingVisibleUntil } from "@/domain/jobs/visibility";
import { isBlockedFetchTarget } from "@/domain/safety";
import type { Actor } from "@/domain/types";
import { AppError } from "@/http";
import { audit, type SourceRecord } from "@/repositories/db";
import type { StoreCore } from "@/repositories/store/store-core";

type Ctor<T = StoreCore> = new (...args: any[]) => T;

export function WithAdmin<TBase extends Ctor>(Base: TBase) {
  return class extends Base {
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

    listAdminJobs(actor: Actor, scope: "current" | "archive" | "review") {
      this.requireRole(actor, ["admin", "reviewer"]);
      if (scope === "archive") return this.db.jobsArchive;
      if (scope === "review") return this.db.drafts;
      return this.db.jobsCurrent;
    }

    getAdminJob(actor: Actor, jobId: string) {
      this.requireRole(actor, ["admin", "reviewer"]);
      const job = this.findAny(jobId);
      if (!job) throw new AppError(404, "not_available", "This listing is not available.");
      return job;
    }

    overview(actor: Actor, now = new Date()) {
      this.requireRole(actor, ["admin", "reviewer"]);
      return {
        liveJobs: this.db.jobsCurrent.filter(
          (job) => job.lifecycle === "published" && isVisibleAt(listingVisibleUntil(job), now),
        ).length,
        pendingReview: this.db.drafts.length,
        archived: this.db.jobsArchive.length,
        members: this.db.users.filter((user) => !user.deletedAt).length,
      };
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
  };
}
