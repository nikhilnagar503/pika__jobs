import Link from "next/link";
import { SampleCards } from "@/components/sample-cards";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { readActor } from "@/server/auth/session";
import { formatInr, product } from "@/shared/product";
import { withStore } from "@/server/repositories/file-store";

export default async function HomePage() {
  const signedIn = await withStore(async (store) => (await readActor(store)).kind === "user");
  return (
    <>
      <SiteHeader signedIn={signedIn} />
      <main id="main" className="wrap">
        <section className="hero">
          <h1>Less searching. More opportunities.</h1>
          <p className="lede">Explore curated jobs and internships in a simple feed. Choose your interests, check the details, and apply with the employer.</p>
          <div className="cluster">
            <Link className="btn-primary" href={signedIn ? "/feed" : "/auth/sign-up"}>Find jobs free</Link>
            <a href="#how">See how it works</a>
          </div>
        </section>
        <section className="section" aria-label="Sample listings">
          <SampleCards />
          <p className="muted">These cards are fictional samples. They are not live openings and they do not bypass signup.</p>
        </section>
        <section className="section" id="how">
          <h2>Three short steps</h2>
          <div className="grid-3">
            <article className="card"><h3>1. Choose your interests</h3><p className="muted">Jobs, internships, role families, and work mode. Every step can be skipped.</p></article>
            <article className="card"><h3>2. Browse relevant opportunities</h3><p className="muted">A single feed with the facts that matter: role, place, pay if disclosed, and how to apply.</p></article>
            <article className="card"><h3>3. Apply with the employer</h3><p className="muted">Open the employer site or start an email yourself. Pikajobs does not submit applications.</p></article>
          </div>
        </section>
        <section className="section">
          <h2>Coverage</h2>
          <div className="chips">
            {["Jobs", "Internships", "Remote", "Government", "Business roles"].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <p className="muted">Categories become active links as real listings are published. Remote does not mean worldwide eligibility.</p>
        </section>
        <section className="section">
          <h2>Free and Pro</h2>
          <p className="muted">Pro is a one-time {product.proPassDays} day pass at {formatInr(product.draftPriceMinor)}. It does not renew automatically. Jobs may also be available elsewhere. Hiring decisions belong to employers.</p>
          <Link href="/pricing">See the current offer</Link>
        </section>
        <section className="section">
          <h2>Share Pikajobs. Earn 10% on eligible purchases.</h2>
          <p className="muted">There is no cash reward for creating a free account. Earnings follow the published hold, threshold, refund, and payout rules.</p>
          <Link href="/referral-terms">Read the referral terms</Link>
        </section>
        <section className="section faq">
          <h2>Questions</h2>
          <details><summary>Is it free?</summary><p>Yes. A free collection is available after you create an account. Pro is an optional 30 day pass.</p></details>
          <details><summary>Where do I apply?</summary><p>On the employer site or by an email you send to the employer. Pikajobs does not send that email for you.</p></details>
          <details><summary>Are salaries always listed?</summary><p>No. Unknown pay stays unknown. An explicitly unpaid internship is labeled unpaid. Those are different.</p></details>
          <details><summary>What does Pro include?</summary><p>The separately curated Pro collection, and no ads, for 30 days. It does not renew by itself and it does not promise a job or a salary.</p></details>
          <details><summary>How do referral earnings work?</summary><p>You earn 10% of eligible product revenue from purchases by someone who joined through your link, after the hold. A signup alone pays nothing.</p></details>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
