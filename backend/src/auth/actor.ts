import type { Request } from "express";
import { env } from "@/config/env";
import { userFromAccessToken, createSupabaseAdmin } from "@/auth/supabase";
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

  const supabase = createSupabaseAdmin();
  let roles: string[] = [];
  let profile: {
    display_name?: string | null;
    adult_confirmed?: boolean | null;
    country_code?: string | null;
    current_stage?: string | null;
    onboarding_step?: number | null;
    onboarding_completed?: boolean | null;
  } | null = null;

  if (supabase) {
    try {
      const [{ data: profileRow }, { data: roleRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, adult_confirmed, country_code, current_stage, onboarding_step, onboarding_completed")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      profile = profileRow;
      roles = (roleRows ?? []).map((row) => row.role);

      if (!profile) {
        const displayName =
          (typeof user.user_metadata?.display_name === "string" && user.user_metadata.display_name) ||
          user.email.split("@")[0];
        await Promise.all([
          supabase.from("profiles").upsert(
            {
              user_id: user.id,
              display_name: displayName,
              adult_confirmed: user.user_metadata?.adult_confirmed === true,
            },
            { onConflict: "user_id" },
          ),
          supabase.from("user_preferences").upsert({ user_id: user.id }, { onConflict: "user_id" }),
        ]);
      }

      if (user.email.toLowerCase() === env.adminEmail && roles.length === 0) {
        await supabase.rpc("bootstrap_admin");
        const { data: rolesAfter } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
        roles = (rolesAfter ?? []).map((row) => row.role);
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          code: "supabase_profile_failed",
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
    }
  }

  const adultConfirmed = Boolean(profile?.adult_confirmed ?? user.user_metadata?.adult_confirmed === true);
  const displayName =
    profile?.display_name ||
    (typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : "") ||
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
