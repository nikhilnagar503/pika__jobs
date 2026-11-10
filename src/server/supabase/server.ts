import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseServiceRoleKey, supabaseUrl } from "@/server/supabase/env";

export async function createSupabaseServerClient() {
  const jar = await cookies();
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const cookie of cookiesToSet) {
            jar.set(cookie.name, cookie.value, cookie.options);
          }
        } catch {
          // Called from a Server Component where cookies are read-only.
        }
      },
    },
  });
}

export function createSupabaseAdminClient() {
  const serviceKey = supabaseServiceRoleKey();
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
  }
  return createClient(supabaseUrl(), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
