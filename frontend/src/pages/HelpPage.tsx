import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export function HelpPage() {
  const { user } = useAuth();
  return (
    <main className="wrap" style={{ maxWidth: 760, paddingTop: 40, paddingBottom: 64 }}>
      <p className="eyebrow">Guide</p>
      <h1>User manual</h1>
      <p className="muted">How to use Pikajobs as a student or job seeker.</p>

      <section className="faq" style={{ marginTop: 24 }}>
        <details open>
          <summary>What is Pikajobs?</summary>
          <p>
            Pikajobs is a curated feed of jobs and internships. You browse cards, save the ones you like, and apply on the employer site or by email. Pikajobs does not send applications for you.
          </p>
        </details>
        <details>
          <summary>How do I start?</summary>
          <ol>
            <li>Create an account with email or Google. You must be 18+.</li>
            <li>Open <Link to={user ? "/feed" : "/auth/sign-in"}>Feed</Link>.</li>
            <li>Read a card. If it looks right, click the apply link or email.</li>
            <li>Use Save to keep a role for later. Activity shows what you opened.</li>
          </ol>
        </details>
        <details>
          <summary>What does the feed show?</summary>
          <p>
            Only listings from the last 14 days, newest first. Older roles drop off automatically. Search by company, role, or stipend from the search box.
          </p>
        </details>
        <details>
          <summary>How do I apply?</summary>
          <p>
            Each card has an apply link, an HR email, or both. Click Apply to leave Pikajobs and finish on the employer form or in your mail app. We do not upload your CV.
          </p>
        </details>
        <details>
          <summary>Saved and Activity</summary>
          <p>
            Saved is your shortlist. Activity is a log of jobs you opened or marked. Neither one applies for you.
          </p>
        </details>
        <details>
          <summary>Account</summary>
          <p>
            Open Account to see your email, sign out, or delete your account. Deleting your account removes your Pikajobs profile and saved items.
          </p>
        </details>
      </section>
    </main>
  );
}
