import Link from "next/link";
import { requestMagicLink, signInWithPassword } from "@/server/actions";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const query = await searchParams;
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap section" style={{ maxWidth: 520 }}>
        <h1>Sign in</h1>
        <p className="muted">Sign in with your email and password, or request a magic link.</p>
        {query.error && <p className="error">{query.error}</p>}
        <form action={signInWithPassword}>
          <input type="hidden" name="next" value={query.next ?? "/auth/complete"} />
          <label className="field">
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="field">
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="btn-primary" type="submit">
            Sign in
          </button>
        </form>
        <hr style={{ margin: "24px 0", border: 0, borderTop: "1px solid var(--border)" }} />
        <p className="muted">Or email yourself a one-time magic link.</p>
        <form action={requestMagicLink}>
          <input type="hidden" name="mode" value="sign-in" />
          <input type="hidden" name="next" value={query.next ?? "/feed"} />
          <label className="field">
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <button className="btn-ghost" type="submit">
            Email me a magic link
          </button>
        </form>
        <p>
          New here? <Link href="/auth/sign-up">Create an account</Link>
        </p>
      </main>
    </>
  );
}
