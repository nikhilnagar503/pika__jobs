import Link from "next/link";
import { requestMagicLink, signInWithGoogle } from "@/server/actions";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Create account" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const query = await searchParams;
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap section" style={{ maxWidth: 560 }}>
        <h1>Find jobs free</h1>
        <p className="muted">
          Pikajobs is for adults aged 18 and over. We send a magic link to your email — no password is stored in
          Pikajobs. Signing up is not consent for promotional email.
        </p>
        {query.error && <p className="error">{query.error}</p>}
        <form action={requestMagicLink}>
          <input type="hidden" name="mode" value="sign-up" />
          <input type="hidden" name="next" value={query.next ?? "/onboarding"} />
          <label className="field">
            Name
            <input name="displayName" autoComplete="name" />
          </label>
          <label className="field">
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="checks">
            <input type="checkbox" name="adult" value="yes" required /> I am 18 or older
          </label>
          <button className="btn-primary" type="submit">
            Email me a magic link
          </button>
        </form>
        <form action={signInWithGoogle} style={{ marginTop: 12 }}>
          <input type="hidden" name="next" value="/auth/complete" />
          <button className="btn-ghost" type="submit">
            Continue with Google
          </button>
        </form>
        <p>
          Already have an account? <Link href="/auth/sign-in">Sign in</Link>
        </p>
      </main>
    </>
  );
}
