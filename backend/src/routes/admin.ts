import { Router } from "express";
import type { JobInput } from "@/repositories/memory";
import { fingerprint } from "@/domain/money";
import { AppError } from "@/http";
import { asyncHandler, requireAdmin } from "@/middleware/store";
import { parseJobImportJson } from "@/shared/job-json-import";

export const adminRouter = Router();

adminRouter.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    res.json(req.store.overview(actor));
  }, { persist: false }),
);

adminRouter.get(
  "/jobs",
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const scope = req.query.scope === "archive" || req.query.scope === "review" ? req.query.scope : "current";
    res.json({ items: req.store.listAdminJobs(actor, scope) });
  }, { persist: false }),
);

adminRouter.post(
  "/jobs",
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const publish = body.publish === true;
    const sourceId =
      typeof body.sourceId === "string" && body.sourceId
        ? body.sourceId
        : req.store.ensureManualListingSource(actor).id;
    const input = {
      ...body,
      sourceId,
      companyName: body.companyName ?? body.company,
    } as JobInput;
    const saved = req.store.saveJob(actor, input);
    if (publish) req.store.publishJob(actor, saved.jobId);
    res.status(201).json({ jobId: saved.jobId, lifecycle: publish ? "published" : saved.lifecycle, publish });
  }),
);

adminRouter.post(
  "/jobs/import/preview",
  asyncHandler(async (req, res) => {
    requireAdmin(req);
    try {
      const parsed = parseJobImportJson(req.body?.payload ?? req.body);
      const seen = new Set<string>();
      const drafts = [];
      const skipped = [...parsed.skipped];

      for (const draft of parsed.drafts) {
        const key = fingerprint([draft.companyName, draft.title]);
        if (seen.has(key)) {
          skipped.push({
            key: draft.importKey,
            company: draft.companyName,
            title: draft.title,
            reason: `Duplicate in this file: ${draft.companyName} · ${draft.title}`,
          });
          continue;
        }
        const existing = req.store.findLiveCompanyTitleDuplicate(draft.companyName, draft.title);
        if (existing) {
          skipped.push({
            key: draft.importKey,
            company: draft.companyName,
            title: draft.title,
            reason: `Already live on the feed: ${existing.companyName} · ${existing.title}`,
          });
          continue;
        }
        seen.add(key);
        drafts.push(draft);
      }

      res.json({
        format: parsed.format,
        category: parsed.category,
        generatedDate: parsed.generatedDate,
        totalCount: parsed.totalCount,
        draftCount: drafts.length,
        skippedCount: skipped.length,
        drafts,
        skipped,
      });
    } catch (error) {
      throw new AppError(
        422,
        "invalid_import",
        error instanceof Error ? error.message : "Could not parse job JSON.",
      );
    }
  }, { persist: false }),
);

adminRouter.post(
  "/jobs/import",
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const publish = req.body?.publish === true;
    let drafts: Array<Record<string, unknown>> = [];
    let meta = {
      format: "edited",
      category: null as string | null,
      generatedDate: null as string | null,
      totalCount: 0,
      skipped: [] as Array<{ key: string; company: string; title: string; reason: string }>,
    };

    if (Array.isArray(req.body?.drafts)) {
      drafts = req.body.drafts as Array<Record<string, unknown>>;
      meta.format = typeof req.body.format === "string" ? req.body.format : "edited";
      meta.category = typeof req.body.category === "string" ? req.body.category : null;
      meta.generatedDate = typeof req.body.generatedDate === "string" ? req.body.generatedDate : null;
      if (Array.isArray(req.body.skipped)) {
        meta.skipped = req.body.skipped
          .filter((item: unknown) => item && typeof item === "object")
          .map((item: { key?: string; company?: string; title?: string; reason?: string }) => ({
            key: typeof item.key === "string" && item.key ? item.key : crypto.randomUUID(),
            company: typeof item.company === "string" && item.company ? item.company : "Unknown company",
            title: typeof item.title === "string" && item.title ? item.title : "Untitled role",
            reason: typeof item.reason === "string" && item.reason ? item.reason : "Skipped before posting.",
          }));
      }
      meta.totalCount =
        typeof req.body.totalCount === "number" && req.body.totalCount > 0
          ? req.body.totalCount
          : drafts.length + meta.skipped.length;
    } else {
      try {
        const parsed = parseJobImportJson(req.body?.payload ?? req.body);
        drafts = parsed.drafts as unknown as Array<Record<string, unknown>>;
        meta = {
          format: parsed.format,
          category: parsed.category,
          generatedDate: parsed.generatedDate,
          totalCount: parsed.totalCount,
          skipped: parsed.skipped,
        };
      } catch (error) {
        throw new AppError(
          422,
          "invalid_import",
          error instanceof Error ? error.message : "Could not parse job JSON.",
        );
      }
    }

    if (!drafts.length) {
      throw new AppError(422, "invalid_import", "No jobs left to import. Keep at least one listing in the preview.");
    }

    const source = req.store.ensureManualListingSource(actor);
    const created: Array<{ importKey: string; jobId: string; lifecycle: string; companyName: string; title: string }> = [];
    const failed: Array<{ importKey: string; companyName: string; title: string; message: string }> = [];
    const skipped = [...meta.skipped];
    const seen = new Set<string>();

    for (const draft of drafts) {
      const importKey = typeof draft.importKey === "string" ? draft.importKey : crypto.randomUUID();
      const companyName = typeof draft.companyName === "string" ? draft.companyName : "";
      const title = typeof draft.title === "string" ? draft.title : "";
      const key = fingerprint([companyName, title]);

      if (!companyName || !title) {
        skipped.push({
          key: importKey,
          company: companyName || "Unknown company",
          title: title || "Untitled role",
          reason: "Missing company or title.",
        });
        continue;
      }
      if (seen.has(key)) {
        skipped.push({
          key: importKey,
          company: companyName,
          title,
          reason: `Duplicate in this batch: ${companyName} · ${title}`,
        });
        continue;
      }
      const existing = req.store.findLiveCompanyTitleDuplicate(companyName, title);
      if (existing) {
        skipped.push({
          key: importKey,
          company: companyName,
          title,
          reason: `Already live on the feed: ${existing.companyName} · ${existing.title}`,
        });
        continue;
      }

      try {
        const {
          importKey: _key,
          skipped: _skipped,
          skipReason: _reason,
          jobId: _jobId,
          expectedVersion: _expectedVersion,
          ...input
        } = draft;
        const externalJobId =
          typeof input.externalJobId === "string" && input.externalJobId
            ? input.externalJobId
            : importKey;
        const already = req.store.findLiveExternalJob(source.id, externalJobId);
        if (already) {
          skipped.push({
            key: importKey,
            company: companyName,
            title,
            reason: `Already imported: ${already.companyName} · ${already.title}`,
          });
          continue;
        }
        const saved = req.store.saveJob(actor, {
          ...input,
          sourceId: source.id,
          externalJobId,
        } as JobInput);
        const published = publish ? req.store.publishJob(actor, saved.jobId) : saved;
        seen.add(key);
        created.push({
          importKey,
          jobId: published.jobId,
          lifecycle: published.lifecycle,
          companyName,
          title,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Import failed.";
        const reason =
          error instanceof AppError && error.code === "version_required"
            ? `${companyName} · ${title} collided with another listing identity. Use a unique apply link or email.`
            : message;
        if (
          error instanceof AppError &&
          (error.code === "duplicate_listing" || error.code === "version_required" || error.code === "archived")
        ) {
          skipped.push({ key: importKey, company: companyName, title, reason });
        } else {
          failed.push({ importKey, companyName, title, message: reason });
        }
      }
    }

    res.status(201).json({
      format: meta.format,
      category: meta.category,
      generatedDate: meta.generatedDate,
      totalCount: meta.totalCount || drafts.length + skipped.length + failed.length,
      publish,
      createdCount: created.length,
      skippedCount: skipped.length,
      failedCount: failed.length,
      created,
      skipped,
      failed,
    });
  }),
);

adminRouter.get(
  "/jobs/:id",
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    res.json({ job: req.store.getAdminJob(actor, req.params.id) });
  }, { persist: false }),
);

adminRouter.put(
  "/jobs/:id",
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const existing = req.store.getAdminJob(actor, req.params.id);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const publish = body.publish === true;
    const input = {
      ...body,
      jobId: req.params.id,
      expectedVersion: typeof body.expectedVersion === "number" ? body.expectedVersion : existing.version,
      sourceId: typeof body.sourceId === "string" && body.sourceId ? body.sourceId : existing.sourceId,
      companyName: body.companyName ?? body.company ?? existing.companyName,
      sourceUrl: body.sourceUrl ?? existing.sourceUrl,
      evidenceExcerpt:
        body.evidenceExcerpt ??
        existing.evidence[0]?.excerpt ??
        existing.summary,
    } as JobInput;
    const saved = req.store.saveJob(actor, input);
    const published = publish && saved.lifecycle !== "published" ? req.store.publishJob(actor, saved.jobId) : saved;
    res.json({ jobId: published.jobId, lifecycle: published.lifecycle, version: published.version, publish });
  }),
);

adminRouter.post(
  "/jobs/:id/publish",
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    res.json(req.store.publishJob(actor, req.params.id));
  }),
);

adminRouter.post(
  "/jobs/:id/archive",
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const reason = typeof req.body?.reason === "string" ? req.body.reason : "Archived by admin";
    res.json(req.store.archiveJob(actor, req.params.id, reason));
  }),
);

adminRouter.delete(
  "/jobs/:id",
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    res.json(req.store.deleteJob(actor, req.params.id));
  }),
);

adminRouter.post(
  "/jobs/:id/delete",
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    res.json(req.store.deleteJob(actor, req.params.id));
  }),
);

adminRouter.post(
  "/jobs/delete-many",
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const ids = Array.isArray(req.body?.jobIds)
      ? req.body.jobIds.filter((id: unknown): id is string => typeof id === "string" && Boolean(id))
      : [];
    if (!ids.length) {
      throw new AppError(422, "invalid_import", "Select at least one job to delete.");
    }
    const deleted: string[] = [];
    const failed: Array<{ jobId: string; message: string }> = [];
    for (const jobId of ids) {
      try {
        req.store.deleteJob(actor, jobId);
        deleted.push(jobId);
      } catch (error) {
        failed.push({
          jobId,
          message: error instanceof Error ? error.message : "Could not delete.",
        });
      }
    }
    res.json({ deletedCount: deleted.length, failedCount: failed.length, deleted, failed });
  }),
);

adminRouter.get(
  "/sources",
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    res.json({ items: req.store.listSources(actor) });
  }, { persist: false }),
);
