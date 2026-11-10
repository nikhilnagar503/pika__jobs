import { NextResponse } from "next/server";
import { readActor } from "@/server/auth/session";
import { assertSameOrigin, jsonError } from "@/server/http";
import { withStore } from "@/server/repositories/file-store";
import type { MemoryStore } from "@/server/repositories/memory";
import type { Actor } from "@/server/domain/types";

export async function actorFrom(request: Request, store: MemoryStore): Promise<Actor> {
  const header = request.headers.get("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer ")) return store.authenticateAgent(header.slice(7).trim());
  return readActor(store);
}

export function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

export function redirectOrJson(request: Request, status: number, body: unknown, location?: string) {
  if (location && request.headers.get("sec-fetch-mode") !== "cors") {
    return NextResponse.redirect(location, 303);
  }
  return Response.json(body, { status });
}

export async function run(request: Request, fn: (store: MemoryStore, actor: Actor) => Promise<unknown> | unknown, mutate = false) {
  const requestId = crypto.randomUUID();
  try {
    if (mutate) assertSameOrigin(request);
    return await withStore(async (store) => {
      const actor = await actorFrom(request, store);
      const result = await fn(store, actor);
      if (result instanceof Response) return result;
      return Response.json(result);
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
