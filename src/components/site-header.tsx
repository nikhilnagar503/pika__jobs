import Link from "next/link";
import { isSignedIn } from "@/server/auth/session";

export async function SiteHeader({ signedIn }: { signedIn?: boolean }) {
  const authed = signedIn ?? (await isSignedIn());
  return (
    <header className="wrap topbar">
      <Link className="wordmark" href="/">Pikajobs</Link>
      <nav className="nav-links" aria-label="Primary">
        <a href="/#how">How it works</a>
        <Link href="/pricing">Pricing</Link>
        {authed ? <Link href="/feed">Feed</Link> : <Link href="/auth/sign-in">Sign in</Link>}
        <Link className="btn-primary" href={authed ? "/feed" : "/auth/sign-up"}>Find jobs free</Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="wrap footer">
      <strong>Pikajobs</strong>
      <nav className="footer-links" aria-label="Footer">
        <Link href="/contact">About</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/refunds">Refund policy</Link>
        <Link href="/referral-terms">Referral terms</Link>
        <Link href="/contact">Report a listing</Link>
      </nav>
    </footer>
  );
}
