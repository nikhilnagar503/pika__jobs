import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import ws from "ws";
import { env, supabaseConfigured } from "@/config/env";

function createServerClient(apiKey: string): SupabaseClient {
  return createClient(env.supabaseUrl, apiKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Node 20 on the VPS has no built-in WebSocket; Supabase realtime requires one.
    realtime: { transport: ws as unknown as typeof WebSocket },
  });
}

export function createSupabaseAdmin(): SupabaseClient | null {
  if (!supabaseConfigured()) return null;
  const key = env.supabaseServiceRoleKey || env.supabaseAnonKey;
  if (!key) return null;
  try {
    return createServerClient(key);
  } catch (error) {
    console.error(
      JSON.stringify({
        code: "supabase_admin_client_failed",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
    return null;
  }
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

  // Prefer plain HTTP on the server — avoids realtime/WebSocket entirely for auth.
  try {
    const user = await userFromAuthApi(token);
    if (user) return user;
  } catch (error) {
    console.error(
      JSON.stringify({
        code: "supabase_get_user_http_failed",
        message: error instanceof Error ? error.message : "unknown",
      }),
    );
  }

  const apiKey = env.supabaseServiceRoleKey || env.supabaseAnonKey;
  if (!apiKey) return null;

  try {
    const client = createServerClient(apiKey);
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

  return null;
}
