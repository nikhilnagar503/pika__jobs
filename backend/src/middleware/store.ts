import type { NextFunction, Request, Response } from "express";
import { actorFromRequest } from "@/auth/actor";
import { AppError, errorJson } from "@/http";
import { product } from "@/shared/product";
import { withStore } from "@/repositories/file-store";
import type { MemoryStore } from "@/repositories/memory";
import type { Actor } from "@/domain/types";

export type StoreRequest = Request & {
  store: MemoryStore;
  actor: Actor;
  requestId: string;
};

export function asyncHandler(
  fn: (req: StoreRequest, res: Response) => Promise<void> | void,
  options: { persist?: boolean } = {},
) {
  return (req: Request, res: Response, _next: NextFunction) => {
    const requestId = crypto.randomUUID();
    withStore(async (store) => {
      const actor = await actorFromRequest(req, store);
      const scoped = req as StoreRequest;
      scoped.store = store;
      scoped.actor = actor;
      scoped.requestId = requestId;
      await fn(scoped, res);
    }, { persist: options.persist !== false }).catch((error) => {
      const result = errorJson(error, requestId);
      res.status(result.status).json(result.body);
    });
  };
}

export function requireUser(req: StoreRequest) {
  if (req.actor.kind !== "user") {
    throw new AppError(401, "sign_in_required", "Sign in to continue.");
  }
  return req.actor;
}

export function requireAdmin(req: StoreRequest) {
  const actor = requireUser(req);
  if (
    actor.email.toLowerCase() !== product.adminEmail.toLowerCase() ||
    (!actor.roles.includes("admin") && !actor.roles.includes("reviewer"))
  ) {
    throw new AppError(403, "forbidden", "Admin access required.");
  }
  return actor;
}
