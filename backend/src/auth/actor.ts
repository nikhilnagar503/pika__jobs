import type { Request } from "express";
import { env } from "@/config/env";
import {
  bootstrapAdminIfNeeded,
  ensureProfile,
  fetchProfile,
  fetchRoles,
  userFromAccessToken,
} from "@/auth/supabase";
import type { Actor } from "@/domain/types";
import type { MemoryStore } from "@/repositories/memory";

export async function actorFromRequest(req: Request, store: MemoryStore): Promise<Actor> {
  const header = req.header("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return { kind: "anonymous" };

  const token = header.slice(7).trim();
  if (!token.includes(".") || token.startsWith("pj_")) {
    try {
      return store.authenticateAgent(token);
    } catch {
      // fall through to Supabase user token
    }
  }

  const user = await userFromAccessToken(token);
  if (!user?.id || !user.email) return { kind: "anonymous" };

  let roles: string[] = [];
  let profile: {
    display_name?: string | null;
    adult_confirmed?: boolean | null;
    country_code?: string | null;
    current_stage?: string | null;
    onboarding_step?: number | null;
    onboarding_completed?: boolean | null;
  } | null = null;

  try {
    const [profileRow, roleRows] = await Promise.all([fetchProfile(user.id), fetchRoles(user.id)]);
    profile = profileRow;
    roles = roleRows;

    if (!profile) {
      const displayName =
        (typeof user.user_metadata?.display_name === "string" && user.user_metadata.display_name) ||
        (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
        (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
        user.email.split("@")[0];
      const isAdult = user.user_metadata?.adult_confirmed !== false;
      await ensureProfile(user.id, displayName, isAdult);
      profile = await fetchProfile(user.id);
    }

    if (user.email.toLowerCase() === env.adminEmail && roles.length === 0) {
      roles = await bootstrapAdminIfNeeded(user.id, user.email);
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        code: "supabase_profile_failed",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
  }

  const adultConfirmed = Boolean(
    profile?.adult_confirmed ??
      (user.user_metadata?.adult_confirmed === undefined ? true : user.user_metadata.adult_confirmed === true),
  );
  const displayName =
    profile?.display_name ||
    (typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : "") ||
    (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "") ||
    (typeof user.user_metadata?.name === "string" ? user.user_metadata.name : "") ||
    user.email.split("@")[0];

  store.ensureAuthUser({
    userId: user.id,
    email: user.email,
    displayName,
    adultConfirmed,
    roles,
  });

  if (profile) {
    const local = store.db.users.find((item) => item.userId === user.id);
    if (local) {
      local.countryCode = profile.country_code || local.countryCode;
      local.currentStage = profile.current_stage || local.currentStage;
      local.onboardingStep = profile.onboarding_step ?? local.onboardingStep;
      local.onboardingCompleted = profile.onboarding_completed ?? local.onboardingCompleted;
    }
  }

  return store.actorFor(user.id);
}
