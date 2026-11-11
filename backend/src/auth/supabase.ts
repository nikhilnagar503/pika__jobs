import { createClient, type User } from "@supabase/supabase-js";
import { env, supabaseConfigured } from "@/config/env";

export function createSupabaseAdmin() {
  if (!supabaseConfigured()) return null;
  const key = env.supabaseServiceRoleKey || env.supabaseAnonKey;
  return createClient(env.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function userFromAccessToken(token: string): Promise<User | null> {
  if (!supabaseConfigured() || !token) return null;
  const client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
