import { createClient, type User } from "@supabase/supabase-js";
import { env, supabaseConfigured } from "@/config/env";

export function createSupabaseAdmin() {
  if (!supabaseConfigured()) return null;
  const key = env.supabaseServiceRoleKey || env.supabaseAnonKey;
  if (!key) return null;
  return createClient(env.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function userFromAuthApi(token: string): Promise<User | null> {
  const apiKey = env.supabaseServiceRoleKey || env.supabaseAnonKey;
  if (!env.supabaseUrl || !apiKey) return null;
  const response = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: apiKey,
    },
  });
  if (!response.ok) return null;
  const user = (await response.json()) as User;
  if (!user?.id || !user?.email) return null;
  return user;
}

export async function userFromAccessToken(token: string): Promise<User | null> {
  if (!supabaseConfigured() || !token) return null;

  // Prefer secret/service key on the server (sb_secret_... or legacy service_role).
  const apiKey = env.supabaseServiceRoleKey || env.supabaseAnonKey;
  if (!apiKey) return null;

  try {
    const client = createClient(env.supabaseUrl, apiKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (!error && data.user?.id && data.user.email) return data.user;
  } catch (error) {
    console.error(
      JSON.stringify({
        code: "supabase_get_user_sdk_failed",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
  }

  try {
    return await userFromAuthApi(token);
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
