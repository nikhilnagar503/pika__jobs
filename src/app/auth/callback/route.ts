import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/feed";
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/feed";
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.redirect(new URL(`/auth/sign-in?error=${encodeURIComponent("Supabase Auth is not configured.")}`, url.origin));
  }
  return NextResponse.redirect(new URL(safe, url.origin));
}
