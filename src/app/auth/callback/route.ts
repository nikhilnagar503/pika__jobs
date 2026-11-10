import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseConfigured, supabaseUrl } from "@/server/supabase/env";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/auth/complete";
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/auth/complete";

  if (!supabaseConfigured()) {
    return NextResponse.redirect(
      new URL(`/auth/sign-in?error=${encodeURIComponent("Supabase Auth is not configured.")}`, url.origin),
    );
  }

  const redirectTo = new URL(safe, url.origin);
  const response = NextResponse.redirect(redirectTo);

  if (!code) {
    return NextResponse.redirect(
      new URL(`/auth/sign-in?error=${encodeURIComponent("Missing sign-in code.")}`, url.origin),
    );
  }

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.headers
          .get("cookie")
          ?.split("; ")
          .filter(Boolean)
          .map((part) => {
            const index = part.indexOf("=");
            return { name: part.slice(0, index), value: decodeURIComponent(part.slice(index + 1)) };
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const displayName =
      (typeof user.user_metadata?.display_name === "string" && user.user_metadata.display_name) ||
      user.email?.split("@")[0] ||
      "Member";
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
    await supabase.rpc("bootstrap_admin");
  }

  return response;
}
