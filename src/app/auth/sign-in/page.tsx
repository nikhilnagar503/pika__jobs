import { signIn } from "@/server/actions";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const query = await searchParams;
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap section" style={{ maxWidth: 520 }}>
        <h1>Sign in</h1>
        <p className="muted">Development identity for this local file store. Production sign-in will use Supabase email or Google after those accounts exist. No password is stored.</p>
        {query.error && <p className="error">{query.error}</p>}
        <form action={signIn}>
          <input type="hidden" name="next" value={query.next ?? "/feed"} />
          <label className="field">Email<input name="email" type="email" autoComplete="email" required /></label>
          <button className="btn-primary" type="submit">Continue</button>
        </form>
      </main>
    </>
  );
}
