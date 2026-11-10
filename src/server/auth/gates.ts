import type { Actor } from "@/server/domain/types";
import type { MemoryStore } from "@/server/repositories/memory";
import { readActor } from "@/server/auth/session";

export async function requireMember(
  store: MemoryStore,
  nextPath: string,
): Promise<{ actor: Extract<Actor, { kind: "user" }> } | { redirectTo: string }> {
  const actor = await readActor(store);
  if (actor.kind !== "user") {
    return { redirectTo: `/auth/sign-in?next=${encodeURIComponent(nextPath)}` };
  }
  const user = store.db.users.find((item) => item.userId === actor.userId);
  if (!user?.adultConfirmed) {
    return { redirectTo: "/auth/confirm-age" };
  }
  return { actor };
}
