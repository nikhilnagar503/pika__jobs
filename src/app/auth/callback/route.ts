import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseConfigured, supabaseUrl } from "@/server/supabase/env";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/feed";
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/feed";

  if (!supabaseConfigured()) {
    return NextResponse.redirect(
      new URL(`/auth/sign-in?error=${encodeURIComponent("Supabase Auth is not configured.")}`, url.origin),
    );
  }

  const redirectTo = new URL(safe, url.origin);
  const response = NextResponse.redirect(redirectTo);

  if (code) {
    const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
      cookies: {
        getAll() {
          return request.headers
            .get("cookie")
            ?.split("; ")
            .filter(Boolean)
            .map((part) => {
              const index = part.indexOf("=");
              return { name: part.slice(0, index), value: part.slice(index + 1) };
            }) ?? [];
        },
        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            response.cookies.set(cookie.name, cookie.value, cookie.options);
          }
        },
      },
    });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/auth/sign-in?error=${encodeURIComponent(error.message)}`, url.origin),
      );
    }
  }

  return response;
}
