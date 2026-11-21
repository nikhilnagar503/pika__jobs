import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export function HomePage() {
  const { user } = useAuth();
  return (
    <main id="main" className="wrap home">
      <section className="hero">
        <h1>Less searching. More opportunities.</h1>
        <p className="lede">
          A curated feed of jobs and internships. Free. Only the last 7 days stay live.
          You apply on the employer site — Pikajobs does not send your CV.
        </p>
        <div className="cluster">
          <Link className="btn-primary" to={user ? "/feed" : "/auth/sign-up"}>
            {user ? "Open feed" : "Find jobs free"}
          </Link>
          <a href="#how">See how it works</a>
        </div>
      </section>
      <section className="section home-steps" id="how">
        <h2>How it works</h2>
        <div className="grid-3">
          <article className="card home-step">
            <h3>Filter the feed</h3>
            <p className="muted">Job or internship, city, remote, stipend or CTC.</p>
          </article>
          <article className="card home-step">
            <h3>Read a listing</h3>
            <p className="muted">Role, pay, place, and who it is for — then save it if you need time.</p>
          </article>
          <article className="card home-step">
            <h3>Apply with the employer</h3>
            <p className="muted">Open their form or email them yourself. We never apply for you.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
