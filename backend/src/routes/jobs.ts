import { Router } from "express";
import { emptyFilters } from "@/domain/jobs/feed";
import { AppError } from "@/http";
import { asyncHandler, requireUser } from "@/middleware/store";

export const jobsRouter = Router();

jobsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    requireUser(req);
    const filters = { ...emptyFilters() };
    const kind = req.query.kind;
    if (typeof kind === "string" && kind) filters.kinds = kind.split(",");
    const mode = req.query.mode;
    if (typeof mode === "string" && mode) filters.workModes = mode.split(",");
    const sector = req.query.sector;
    if (typeof sector === "string" && sector) filters.sectors = sector.split(",");
    const q = req.query.q;
    if (typeof q === "string" && q) filters.q = q;
    if (req.query.unknown === "0") filters.includeUnknownPay = false;
    const page = req.store.listFeed(req.actor, {
      filters,
      sort: req.query.sort === "latest" ? "latest" : "for_you",
      cursor: typeof req.query.cursor === "string" ? req.query.cursor : null,
      preview: req.query.preview === "pro" ? "pro" : req.query.preview === "free" ? "free" : null,
    });
    res.json(page);
  }, { persist: false }),
);

jobsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    requireUser(req);
    const view = req.store.getJob(req.actor, req.params.id);
    res.json(view);
  }, { persist: false }),
);

jobsRouter.post(
  "/:id/open-application",
  asyncHandler(async (req, res) => {
    requireUser(req);
    const result = req.store.openApplication(req.actor, req.params.id);
    if (result.url) {
      res.json({ url: result.url, kind: result.kind });
      return;
    }
    res.json({ url: null, kind: result.kind, mailto: result.mailto, email: result.email });
  }),
);
