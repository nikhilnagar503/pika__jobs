import { Link } from "react-router-dom";

export function PrivacyPolicyPage() {
  return (
    <main className="wrap" style={{ maxWidth: 760, paddingTop: 40, paddingBottom: 64 }}>
      <p className="eyebrow">Legal</p>
      <h1>Privacy Policy</h1>
      <p className="muted">Last updated: November 14, 2026</p>

      <section style={{ display: "grid", gap: 24, marginTop: 24 }}>
        <article className="panel">
          <h2>1. Information We Collect</h2>
          <p>
            When you register for or use <strong>Pikajobs</strong>, we collect certain information to provide and improve our service:
          </p>
          <ul style={{ paddingLeft: 20, margin: "12px 0", lineHeight: 1.6 }}>
            <li><strong>Account Information:</strong> When you sign up using your email or Google Account, we receive your email address, name, and profile picture (if provided).</li>
            <li><strong>Preferences & Activity:</strong> Saved listings, job search filters, and application bookmarks you choose to save within your account.</li>
            <li><strong>Technical & Usage Data:</strong> IP address, device type, and standard web log data collected automatically when navigating our platform.</li>
          </ul>
        </article>

        <article className="panel">
          <h2>2. How We Use Your Information</h2>
          <p>We use the collected information solely to:</p>
          <ul style={{ paddingLeft: 20, margin: "12px 0", lineHeight: 1.6 }}>
            <li>Authenticate your identity and manage your member account.</li>
            <li>Deliver personalized job and internship listings matching your preferences.</li>
            <li>Save your bookmarks, recent views, and application activities.</li>
            <li>Protect against unauthorized access, abuse, and fraudulent activity.</li>
          </ul>
        </article>

        <article className="panel">
          <h2>3. Google User Data & OAuth</h2>
          <p>
            When you sign in using Google, we access only the basic profile data (name and email address) authorized via Google OAuth.
          </p>
          <p style={{ marginTop: 8 }}>
            We do <strong>not</strong> request access to your Google Drive, Gmail, contacts, or other private Google services. We strictly adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>.
          </p>
        </article>

        <article className="panel">
          <h2>4. Data Sharing & Third Parties</h2>
          <p>
            <strong>We do not sell, rent, or monetize your personal information to third parties or advertisers.</strong>
          </p>
          <p style={{ marginTop: 8 }}>
            We only share data with essential infrastructure service providers necessary to operate our service (such as Supabase for secure cloud database hosting and authentication). All providers are bound by strict confidentiality and data protection obligations.
          </p>
        </article>

        <article className="panel">
          <h2>5. Data Security & Retention</h2>
          <p>
            We implement industry-standard encryption (TLS/HTTPS in transit and AES-256 at rest) and strict Row Level Security (RLS) policies to protect your data. Your account information is retained as long as your account remains active.
          </p>
        </article>

        <article className="panel">
          <h2>6. Your Rights & Data Deletion</h2>
          <p>
            You have the right to access, update, or delete your personal information at any time. You can request complete deletion of your account and associated data by visiting your <Link to="/account">Account Settings</Link> or emailing us.
          </p>
        </article>

        <article className="panel">
          <h2>7. Contact Us</h2>
          <p>
            If you have questions or concerns regarding this Privacy Policy, please contact us at:
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
          <Link to="/terms">Terms of Service</Link>
          <span>•</span>
          <Link to="/auth/sign-in">Sign in</Link>
        </p>
      </footer>
    </main>
  );
}

