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
  try {
    const client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  } catch (error) {
    console.error(
      JSON.stringify({
        code: "supabase_auth_failed",
        message: error instanceof Error ? error.message : "unknown",
        hint:
          env.supabaseAnonKey.startsWith("sb_")
            ? "Use the legacy anon JWT key (starts with eyJ) from Supabase → Settings → API, not sb_publishable."
            : undefined,
      }),
    );
    return null;
  }
}
