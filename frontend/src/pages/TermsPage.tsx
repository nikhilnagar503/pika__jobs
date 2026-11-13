import { Link } from "react-router-dom";

export function TermsPage() {
  return (
    <main className="wrap" style={{ maxWidth: 760, paddingTop: 40, paddingBottom: 64 }}>
      <p className="eyebrow">Legal</p>
      <h1>Terms of Service</h1>
      <p className="muted">Last updated: November 14, 2026</p>

      <section style={{ display: "grid", gap: 24, marginTop: 24 }}>
        <article className="panel">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using <strong>Pikajobs</strong>, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the platform.
          </p>
        </article>

        <article className="panel">
          <h2>2. Eligibility</h2>
          <p>
            Pikajobs is intended for individuals aged 18 and older. By creating an account or using our services, you confirm that you are at least 18 years of age.
          </p>
        </article>

        <article className="panel">
          <h2>3. Job Listings & Applications</h2>
          <p>
            Pikajobs curates publicly available and direct employer job and internship opportunities. Pikajobs is not an employer, recruiter, or employment agency. We do not guarantee employment, interviews, or hiring decisions. When applying for an opportunity, you submit your application directly to the third-party employer.
          </p>
        </article>

        <article className="panel">
          <h2>4. User Accounts & Security</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized access or security breach.
          </p>
        </article>

        <article className="panel">
          <h2>5. Acceptable Use</h2>
          <p>
            You agree not to scrape, reverse-engineer, overwhelm, or disrupt the platform, nor use it for any fraudulent, unlawful, or abusive purposes.
          </p>
        </article>

        <article className="panel">
          <h2>6. Contact Us</h2>
          <p>
            For any questions or inquiries regarding these Terms, please contact us at:
          </p>
          <p style={{ marginTop: 8 }}>
            <strong>Email:</strong> <a href="mailto:support@pikajobs.com">support@pikajobs.com</a>
          </p>
        </article>
      </section>

      <footer style={{ marginTop: 40, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
        <p className="muted" style={{ display: "flex", gap: 16 }}>
          <Link to="/">Back to Home</Link>
          <span>•</span>
          <Link to="/privacy">Privacy Policy</Link>
          <span>•</span>
          <Link to="/auth/sign-in">Sign in</Link>
        </p>
      </footer>
    </main>
  );
}
