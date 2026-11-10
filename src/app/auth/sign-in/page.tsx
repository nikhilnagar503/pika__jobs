import Link from "next/link";
import { requestMagicLink, signInWithGoogle } from "@/server/actions";
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
        <p className="muted">We email you a one-time magic link. No password is stored in Pikajobs.</p>
        {query.error && <p className="error">{query.error}</p>}
        <form action={requestMagicLink}>
          <input type="hidden" name="mode" value="sign-in" />
          <input type="hidden" name="next" value={query.next ?? "/feed"} />
          <label className="field">
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <button className="btn-primary" type="submit">
            Email me a magic link
          </button>
        </form>
        <form action={signInWithGoogle} style={{ marginTop: 12 }}>
          <input type="hidden" name="next" value={query.next ?? "/auth/complete"} />
          <button className="btn-ghost" type="submit">
            Continue with Google
          </button>
        </form>
        <p>
          New here? <Link href="/auth/sign-up">Create an account</Link>
        </p>
      </main>
    </>
  );
}
