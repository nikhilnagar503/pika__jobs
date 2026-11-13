import { Link } from "react-router-dom";

export function AdminGuidePage() {
  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Admin manual</h1>
          <p className="muted">How to run the workspace: feed, drafts, JSON import, archive, and members.</p>
        </div>
      </header>

      <section className="faq">
        <details open>
          <summary>What the Overview numbers mean</summary>
          <ul>
            <li><strong>Live on feed</strong> — published jobs still inside the 14-day window. Students can see these.</li>
            <li><strong>Drafts</strong> — saved but not live. Publish them from Admin feed or Jobs list.</li>
            <li><strong>Archived</strong> — left the live feed. Either you deleted them, or they aged past 14 days.</li>
            <li><strong>Members</strong> — people who signed up, including your admin account.</li>
          </ul>
        </details>
        <details>
          <summary>How to post jobs</summary>
          <ol>
            <li><Link to="/admin/jobs/new">Post a job</Link> — type one listing, then Save draft or Save and publish.</li>
            <li><Link to="/admin/jobs/import">Import JSON</Link> — upload a file, preview every row, then post. Email-only jobs are valid if an HR email is present.</li>
            <li>On a draft card, click <strong>Publish</strong> to put it on the student feed.</li>
          </ol>
        </details>
        <details>
          <summary>JSON import report</summary>
          <p>
            After upload you see Ready vs Cannot post, with company, title, and reason. After posting you see Posted, Not posted, and Failed. Same company + title cannot be live twice in the 14-day window.
          </p>
        </details>
        <details>
          <summary>Drafts vs live</summary>
          <p>
            Drafts stay off the student feed until you publish. Open <Link to="/admin/feed?lifecycle=draft">Drafts</Link>, then Publish on the card or Publish all drafts. If publish fails, the reason stays on the card — often a duplicate of a live listing.
          </p>
        </details>
        <details>
          <summary>Archive</summary>
          <p>
            Open <Link to="/admin/archive">Archive</Link> to see every job that left the live feed. “Deleted by admin” means you (or bulk delete) removed it. “visibility_cutoff” means the 14-day window ended. Archived jobs are not shown to students.
          </p>
        </details>
        <details>
          <summary>Members</summary>
          <p>
            Open <Link to="/admin/members">Members</Link> to see who signed up: name, email, date, and whether they are a member or admin. This count is accounts, not page views.
          </p>
        </details>
        <details>
          <summary>Student feed rules</summary>
          <p>
            Students only see published jobs from the last 14 days. Newest upload/publish time is first. Apply happens on the employer site or by email. Pikajobs does not submit applications.
          </p>
        </details>
      </section>
    </div>
  );
}
