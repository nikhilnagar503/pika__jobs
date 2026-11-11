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
  "/jobs/import",
  asyncHandler(async (req, res) => {
    const actor = requireAdmin(req);
    const publish = req.body?.publish === true;
    let parsed;
    try {
      parsed = parseJobImportJson(req.body?.payload ?? req.body);
    } catch (error) {
      throw new AppError(
        422,
        "invalid_import",
        error instanceof Error ? error.message : "Could not parse job JSON.",
      );
    }

    const source = req.store.ensureManualListingSource(actor);
    const created: Array<{ importKey: string; jobId: string; lifecycle: string }> = [];
    const failed: Array<{ importKey: string; message: string }> = [];

    for (const draft of parsed.drafts) {
      try {
        const { importKey, ...input } = draft;
        const saved = req.store.saveJob(actor, { ...input, sourceId: source.id } as JobInput);
        const published = publish ? req.store.publishJob(actor, saved.jobId) : saved;
        created.push({
          importKey,
          jobId: published.jobId,
          lifecycle: published.lifecycle,
        });
      } catch (error) {
        failed.push({
          importKey: draft.importKey,
          message: error instanceof Error ? error.message : "Import failed.",
        });
      }
    }

    res.status(201).json({
      format: parsed.format,
      category: parsed.category,
      generatedDate: parsed.generatedDate,
      publish,
      createdCount: created.length,
      skippedCount: parsed.skipped.length,
      failedCount: failed.length,
      created,
      skipped: parsed.skipped,
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
