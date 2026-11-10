import Link from "next/link";

const links = [
  ["/feed", "Feed"],
  ["/saved", "Saved"],
  ["/activity", "Activity"],
  ["/referrals", "Referrals"],
  ["/account", "Account"],
];

export function MemberShell({ children, current, rail }: { children: React.ReactNode; current: string; rail?: React.ReactNode }) {
  return (
    <div className="app">
      <nav className="side" aria-label="Account">
        <Link className="wordmark" href="/feed">Pikajobs</Link>
        {links.map(([href, label]) => (
          <Link key={href} href={href} aria-current={current === href ? "page" : undefined}>{label}</Link>
        ))}
        <Link href="/onboarding">Improve your feed</Link>
      </nav>
      <main id="main" className="feed">{children}</main>
      <aside className="rail">{rail ?? <DefaultRail />}</aside>
      <nav className="bottom" aria-label="Mobile">
        {links.slice(0, 4).map(([href, label]) => (
          <Link key={href} href={href} aria-current={current === href ? "page" : undefined}>{label}</Link>
        ))}
      </nav>
    </div>
  );
}

function DefaultRail() {
  return (
    <div className="panel">
      <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>A quieter search</h2>
      <p className="muted">Filters stay in the address bar. Preferences suggest a ranking. They do not hide the rest of the collection.</p>
    </div>
  );
}
