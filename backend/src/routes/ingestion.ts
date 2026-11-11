import { Router } from "express";
import { asyncHandler } from "@/middleware/store";

export const ingestionRouter = Router();

ingestionRouter.post(
  "/jobs",
  asyncHandler(async (req, res) => {
    const key = req.header("idempotency-key") ?? "";
    const result = req.store.submitBatch(req.actor, req.body, key, false);
    res.json(result);
  }),
);

ingestionRouter.post(
  "/dry-run",
  asyncHandler(async (req, res) => {
    const key = req.header("idempotency-key") ?? "";
    const result = req.store.submitBatch(req.actor, req.body, key, true);
    res.json(result);
  }),
);

ingestionRouter.get(
  "/batches/:id",
  asyncHandler(async (req, res) => {
    res.json(req.store.getBatch(req.actor, req.params.id));
  }, { persist: false }),
);
