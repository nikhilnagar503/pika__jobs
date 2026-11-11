import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export function HomePage() {
  const { user } = useAuth();
  return (
    <main id="main" className="wrap">
      <section className="hero">
        <h1>Less searching. More opportunities.</h1>
        <p className="lede">
          Explore curated jobs and internships in a simple feed. Choose your interests, check the details, and apply with the employer.
        </p>
        <div className="cluster">
          <Link className="btn-primary" to={user ? "/feed" : "/auth/sign-up"}>Find jobs free</Link>
          <a href="#how">See how it works</a>
        </div>
      </section>
      <section className="section" id="how">
        <h2>Three short steps</h2>
        <div className="grid-3">
          <article className="card"><h3>1. Choose your interests</h3><p className="muted">Jobs, internships, role families, and work mode.</p></article>
          <article className="card"><h3>2. Browse relevant opportunities</h3><p className="muted">Alert-style cards with role, place, pay, and how to apply.</p></article>
          <article className="card"><h3>3. Apply with the employer</h3><p className="muted">Open the employer site or email them yourself.</p></article>
        </div>
      </section>
    </main>
  );
}
