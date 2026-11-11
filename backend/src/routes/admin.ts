import { Router } from "express";
import type { JobInput } from "@/repositories/memory";
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
      res.json({
        format: parsed.format,
        category: parsed.category,
        generatedDate: parsed.generatedDate,
        draftCount: parsed.drafts.length,
        skippedCount: parsed.skipped.length,
        drafts: parsed.drafts,
        skipped: parsed.skipped,
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
      skipped: [] as Array<{ key: string; reason: string }>,
    };

    if (Array.isArray(req.body?.drafts)) {
      drafts = req.body.drafts as Array<Record<string, unknown>>;
      meta.format = typeof req.body.format === "string" ? req.body.format : "edited";
      meta.category = typeof req.body.category === "string" ? req.body.category : null;
      meta.generatedDate = typeof req.body.generatedDate === "string" ? req.body.generatedDate : null;
    } else {
      try {
        const parsed = parseJobImportJson(req.body?.payload ?? req.body);
        drafts = parsed.drafts as unknown as Array<Record<string, unknown>>;
        meta = {
          format: parsed.format,
          category: parsed.category,
          generatedDate: parsed.generatedDate,
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
    const created: Array<{ importKey: string; jobId: string; lifecycle: string }> = [];
    const failed: Array<{ importKey: string; message: string }> = [];

    for (const draft of drafts) {
      const importKey = typeof draft.importKey === "string" ? draft.importKey : crypto.randomUUID();
      try {
        const { importKey: _key, skipped: _skipped, skipReason: _reason, ...input } = draft;
        const saved = req.store.saveJob(actor, { ...input, sourceId: source.id } as JobInput);
        const published = publish ? req.store.publishJob(actor, saved.jobId) : saved;
        created.push({
          importKey,
          jobId: published.jobId,
          lifecycle: published.lifecycle,
        });
      } catch (error) {
        failed.push({
          importKey,
          message: error instanceof Error ? error.message : "Import failed.",
        });
      }
    }

    res.status(201).json({
      format: meta.format,
      category: meta.category,
      generatedDate: meta.generatedDate,
      publish,
      createdCount: created.length,
      skippedCount: meta.skipped.length,
      failedCount: failed.length,
      created,
      skipped: meta.skipped,
      failed,
    });
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

adminRouter.get(
  "/sources",
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    res.json({ items: req.store.listSources(actor) });
  }, { persist: false }),
);
