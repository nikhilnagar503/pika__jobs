import type { User } from "@supabase/supabase-js";
import { env, supabaseConfigured } from "@/config/env";

type ProfileRow = {
  display_name?: string | null;
  adult_confirmed?: boolean | null;
  country_code?: string | null;
  current_stage?: string | null;
  onboarding_step?: number | null;
  onboarding_completed?: boolean | null;
};

function apiKey(): string {
  return env.supabaseServiceRoleKey || env.supabaseAnonKey;
}

function restHeaders(extra: Record<string, string> = {}): HeadersInit {
  const key = apiKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

/** Validate a user access token via Auth HTTP API (no WebSocket / supabase-js client). */
export async function userFromAccessToken(token: string): Promise<User | null> {
  if (!supabaseConfigured() || !token || !env.supabaseUrl) return null;
  try {
    const response = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: apiKey(),
      },
    });
    if (!response.ok) return null;
    const user = (await response.json()) as User;
    if (!user?.id || !user?.email) return null;
    return user;
  } catch (error) {
    console.error(
      JSON.stringify({
        code: "supabase_get_user_http_failed",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
    return null;
  }
}

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  if (!supabaseConfigured() || !env.supabaseUrl) return null;
  const url = new URL(`${env.supabaseUrl}/rest/v1/profiles`);
  url.searchParams.set("user_id", `eq.${userId}`);
  url.searchParams.set(
    "select",
    "display_name,adult_confirmed,country_code,current_stage,onboarding_step,onboarding_completed",
  );
  const response = await fetch(url, { headers: restHeaders() });
  if (!response.ok) return null;
  const rows = (await response.json()) as ProfileRow[];
  return rows[0] ?? null;
}

export async function fetchRoles(userId: string): Promise<string[]> {
  if (!supabaseConfigured() || !env.supabaseUrl) return [];
  const url = new URL(`${env.supabaseUrl}/rest/v1/user_roles`);
  url.searchParams.set("user_id", `eq.${userId}`);
  url.searchParams.set("select", "role");
  const response = await fetch(url, { headers: restHeaders() });
  if (!response.ok) return [];
  const rows = (await response.json()) as Array<{ role: string }>;
  return rows.map((row) => row.role);
}

export async function ensureProfile(userId: string, displayName: string, adultConfirmed: boolean) {
  if (!supabaseConfigured() || !env.supabaseUrl) return;
  await Promise.all([
    fetch(`${env.supabaseUrl}/rest/v1/profiles`, {
      method: "POST",
      headers: restHeaders({
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify({
        user_id: userId,
        display_name: displayName,
        adult_confirmed: adultConfirmed,
      }),
    }),
    fetch(`${env.supabaseUrl}/rest/v1/user_preferences`, {
      method: "POST",
      headers: restHeaders({
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify({ user_id: userId }),
    }),
  ]);
}

export async function bootstrapAdminIfNeeded(userId: string, email: string): Promise<string[]> {
  if (!supabaseConfigured() || !env.supabaseUrl) return [];
  if (email.toLowerCase() !== env.adminEmail) return fetchRoles(userId);
  const existing = await fetchRoles(userId);
  if (existing.length > 0) return existing;
  await fetch(`${env.supabaseUrl}/rest/v1/rpc/bootstrap_admin`, {
    method: "POST",
    headers: restHeaders(),
    body: "{}",
  });
  return fetchRoles(userId);
}

export async function deleteSupabaseUser(userId: string): Promise<boolean> {
  if (!supabaseConfigured() || !env.supabaseUrl) return false;
  const key = env.supabaseServiceRoleKey || env.supabaseAnonKey;
  if (!key) return false;
  try {
    const response = await fetch(`${env.supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    return response.ok;
  } catch (error) {
    console.error(
      JSON.stringify({
        code: "supabase_delete_user_failed",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
    return false;
  }
}

/** Kept for call-site compatibility; server no longer uses the realtime JS client. */
export function createSupabaseAdmin() {
  return null;
}
