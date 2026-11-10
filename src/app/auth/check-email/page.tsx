import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Check your email" };

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const query = await searchParams;
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap section" style={{ maxWidth: 560 }}>
        <h1>Check your email</h1>
        <p className="lede">
          {query.email
            ? `If an account can use ${query.email}, a magic link is on the way.`
            : "If that address can sign in, a magic link is on the way."}
        </p>
        <p className="muted">Open the link on this device to finish signing in. The link expires after a short time.</p>
        <p>
          <Link href="/auth/sign-in">Use a different email</Link>
        </p>
      </main>
    </>
  );
}
