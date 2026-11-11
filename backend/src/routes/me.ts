import { Router } from "express";
import { asyncHandler, requireUser } from "@/middleware/store";

export const meRouter = Router();

meRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const actor = requireUser(req);
    res.json(req.store.account(actor));
  }, { persist: false }),
);

meRouter.get(
  "/saved",
  asyncHandler(async (req, res) => {
    const actor = requireUser(req);
    res.json({ items: req.store.listSaved(actor) });
  }, { persist: false }),
);

meRouter.put(
  "/saved/:id",
  asyncHandler(async (req, res) => {
    const actor = requireUser(req);
    res.json(req.store.setSaved(actor, req.params.id, true));
  }),
);

meRouter.delete(
  "/saved/:id",
  asyncHandler(async (req, res) => {
    const actor = requireUser(req);
    res.json(req.store.setSaved(actor, req.params.id, false));
  }),
);

meRouter.get(
  "/activity",
  asyncHandler(async (req, res) => {
    const actor = requireUser(req);
    res.json({ items: req.store.listActivity(actor) });
  }, { persist: false }),
);

meRouter.get(
  "/referrals",
  asyncHandler(async (req, res) => {
    const actor = requireUser(req);
    res.json(req.store.referralDashboard(actor));
  }, { persist: false }),
);

meRouter.put(
  "/preferences",
  asyncHandler(async (req, res) => {
    const actor = requireUser(req);
    res.json(req.store.savePreferences(actor, req.body ?? {}));
  }),
);
