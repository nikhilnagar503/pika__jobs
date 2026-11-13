/** Member feed, job detail, saved list, and activity. */
import { product } from "@/shared/product";
import { compareLatest, emptyFilters, matchesFilters, scoreJob, type FeedFilters } from "@/domain/jobs/feed";
import { isVisibleAt, listingVisibleUntil } from "@/domain/jobs/visibility";
import { buildMailto } from "@/domain/safety";
import { canReadTier, type Actor, type JobRecord } from "@/domain/types";
import { AppError } from "@/http";
import type { FeedPage, JobCard } from "@/repositories/store/types";
import {
  afterCursor,
  compareRanked,
  decodeCursor,
  encodeCursor,
  toCard,
} from "@/repositories/store/helpers";
import type { StoreCore } from "@/repositories/store/store-core";

type Ctor<T = StoreCore> = new (...args: any[]) => T;

export function WithFeed<TBase extends Ctor>(Base: TBase) {
  return class extends Base {
    listFeed(actor: Actor, input: {
      filters?: Partial<FeedFilters>;
      sort?: "latest" | "for_you";
      cursor?: string | null;
      preview?: "free" | "pro" | null;
      now?: Date;
    }): FeedPage {
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
          isVisibleAt(listingVisibleUntil(job), now) &&
          new Date(job.publishedAt ?? job.firstSeenAt).getTime() <= asOf.getTime() &&
          canReadTier(actor, job.accessTier, now, preview),
      );
      const matched = visible.filter((job) => matchesFilters(job, filters, asOf));
      const scored = matched.map((job) => ({ job, ...scoreJob(job, sort === "for_you" ? preferences : null, asOf) }));
      scored.sort((a, b) => (sort === "latest" ? compareLatest(a.job, b.job) : compareRanked(a, b)));
      const start = cursor ? scored.findIndex((item) => afterCursor(item, cursor, sort)) : 0;
      const from = start < 0 ? scored.length : start;
      const page = scored.slice(from, from + product.pageSize);
      const savedIds =
        actor.kind === "user"
          ? new Set(this.db.saved.filter((item) => item.userId === actor.userId).map((item) => item.jobId))
          : new Set<string>();
      const items = page.map((item) => ({
        type: "job" as const,
        job: toCard(item.job, item.reasons, savedIds.has(item.job.jobId)),
      }));
      const last = page.at(-1);
      const nextCursor = from + page.length < scored.length && last
        ? encodeCursor({
            sort,
            asOf: asOf.toISOString(),
            at: last.job.publishedAt ?? last.job.firstSeenAt ?? last.job.effectiveJobAt,
            id: last.job.jobId,
            score: last.score,
          })
        : null;
      return {
        items,
        nextCursor,
        asOf: asOf.toISOString(),
        total: matched.length,
      };
    }

    getJob(actor: Actor, jobId: string, now = new Date(), preview: "free" | "pro" | null = null) {
      const job = this.findAny(jobId);
      if (!job || job.lifecycle === "draft" || job.lifecycle === "in_review") {
        throw new AppError(404, "not_available", "This listing is not available.");
      }
      const readable =
        job.lifecycle === "published" &&
        isVisibleAt(listingVisibleUntil(job), now) &&
        this.db.jobsCurrent.some((item) => item.jobId === job.jobId);
      if (!readable) {
        return { status: "unavailable" as const };
      }
      if (actor.kind !== "user") return { status: "sign_in" as const };
      const mode = actor.roles.includes("admin") ? preview : null;
      if (!canReadTier(actor, job.accessTier, now, mode)) {
        return { status: "unavailable" as const };
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
          const live = job.lifecycle === "published" && isVisibleAt(listingVisibleUntil(job), now);
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
      this.db.applications.push({
        id: crypto.randomUUID(),
        userId: user.userId,
        jobId,
        kind: "opened",
        occurredAt: now.toISOString(),
      });
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
      this.db.applications = this.db.applications.filter(
        (item) => !(item.userId === user.userId && item.jobId === jobId && item.kind === "applied"),
      );
      if (applied) {
        this.db.applications.push({
          id: crypto.randomUUID(),
          userId: user.userId,
          jobId,
          kind: "applied",
          occurredAt: now.toISOString(),
        });
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

    protected assertReadable(actor: Actor, jobId: string, now: Date): JobRecord {
      const view = this.getJob(actor, jobId, now);
      if (view.status !== "ok") throw new AppError(404, "not_available", "This listing is not available.");
      const job = this.db.jobsCurrent.find((item) => item.jobId === jobId);
      if (!job) throw new AppError(404, "not_available", "This listing is not available.");
      return job;
    }
  };
}
