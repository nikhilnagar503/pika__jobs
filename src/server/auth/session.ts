import { cookies } from "next/headers";
import type { Actor } from "@/server/domain/types";
import type { MemoryStore } from "@/server/repositories/memory";
import { supabaseConfigured } from "@/server/supabase/env";
import { createSupabaseServerClient } from "@/server/supabase/server";

export async function readActor(store: MemoryStore): Promise<Actor> {
  if (!supabaseConfigured()) return { kind: "anonymous" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return { kind: "anonymous" };

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, adult_confirmed, country_code, current_stage, onboarding_step, onboarding_completed")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  if (!profile) {
    const displayName =
      (typeof user.user_metadata?.display_name === "string" && user.user_metadata.display_name) ||
      user.email.split("@")[0];
    const adultConfirmed = user.user_metadata?.adult_confirmed === true;
    await supabase.from("profiles").upsert(
      {
        user_id: user.id,
        display_name: displayName,
        adult_confirmed: adultConfirmed,
      },
      { onConflict: "user_id" },
    );
    await supabase.from("user_preferences").upsert({ user_id: user.id }, { onConflict: "user_id" });
  }

  await supabase.rpc("bootstrap_admin");

  const { data: rolesAfterBootstrap } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const roles = (rolesAfterBootstrap ?? roleRows ?? []).map((row) => row.role);

  const adultConfirmed = Boolean(profile?.adult_confirmed ?? user.user_metadata?.adult_confirmed === true);
  const displayName =
    profile?.display_name ||
    (typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : "") ||
    user.email.split("@")[0];

  const referral = await referralCookie();
  store.ensureAuthUser({
    userId: user.id,
    email: user.email,
    displayName,
    adultConfirmed,
    roles,
    referralCode: referral,
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

export async function signOutSupabase() {
  if (!supabaseConfigured()) return;
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}

export async function referralCookie(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get("pikajobs_ref")?.value ?? null;
  return value && /^[A-Z2-9]{10}$/.test(value) ? value : null;
}
