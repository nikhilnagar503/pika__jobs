import { Router } from "express";
import type { JobInput } from "@/repositories/memory";
import { asyncHandler, requireAdmin } from "@/middleware/store";

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
