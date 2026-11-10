import Link from "next/link";
import { signUpWithPassword } from "@/server/actions";
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
          Pikajobs is for adults aged 18 and over. Create an account with email and password. Signing up is not
          consent for promotional email.
        </p>
        {query.error && <p className="error">{query.error}</p>}
        <form action={signUpWithPassword}>
          <input type="hidden" name="next" value={query.next ?? "/onboarding"} />
          <label className="field">
            Name
            <input name="displayName" autoComplete="name" />
          </label>
          <label className="field">
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="field">
            Password
            <input name="password" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <label className="checks">
            <input type="checkbox" name="adult" value="yes" required /> I am 18 or older
          </label>
          <button className="btn-primary" type="submit">
            Create account
          </button>
        </form>
        <p>
          Already have an account? <Link href="/auth/sign-in">Sign in</Link>
        </p>
      </main>
    </>
  );
}
