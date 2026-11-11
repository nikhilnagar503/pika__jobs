import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";

export function AdminNewJobPage() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const publish = form.get("publish") === "yes";
    const body = {
      title: String(form.get("title") || ""),
      companyName: String(form.get("company") || ""),
      summary: String(form.get("summary") || ""),
      opportunityKind: String(form.get("kind") || "job"),
      sector: String(form.get("sector") || "private"),
      workMode: String(form.get("mode") || "not_stated"),
      locationLabel: String(form.get("location") || ""),
      batchLabel: String(form.get("batch") || "") || null,
      durationLabel: String(form.get("duration") || "") || null,
      requirements: String(form.get("requirements") || "").split("\n").map((s) => s.trim()).filter(Boolean),
      eligibility: String(form.get("eligibility") || "").split("\n").map((s) => s.trim()).filter(Boolean),
      responsibilities: String(form.get("responsibilities") || "").split("\n").map((s) => s.trim()).filter(Boolean),
      payDisplayLabel: String(form.get("payDisplay") || "") || null,
      compensationType: String(form.get("compensationType") || "not_disclosed"),
      payMinMinor: form.get("payMin") ? Math.round(Number(form.get("payMin")) * 100) : null,
      payMaxMinor: form.get("payMax") ? Math.round(Number(form.get("payMax")) * 100) : null,
      payCurrency: "INR",
      payPeriod: String(form.get("period") || "monthly"),
      applicationMethod: String(form.get("applicationMethod") || "url"),
      applicationUrl: String(form.get("applicationUrl") || "") || null,
      hrEmail: String(form.get("hrEmail") || "") || null,
      emailSubject: String(form.get("emailSubject") || "") || null,
      hrEmailApproved: form.get("hrApproved") === "yes",
      applyNote: String(form.get("applyNote") || "") || null,
      sourceUrl: String(form.get("sourceUrl") || ""),
      evidenceExcerpt: String(form.get("evidence") || ""),
      accessTier: form.get("tier") === "pro" ? "pro" : "free",
      publish,
    };
    try {
      const result = await api<{ jobId: string; publish: boolean }>("/api/v1/admin/jobs", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMessage(`Saved ${result.jobId}${result.publish ? " and published" : " as draft"}.`);
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save listing.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Post a job</h1>
          <p className="muted">Creates a listing through the Express API.</p>
        </div>
        <Link className="btn-ghost" to="/admin/jobs">Back</Link>
      </header>
      {message && <p className="notice">{message}</p>}
      {error && <p className="error">{error}</p>}
      <form className="admin-form" onSubmit={onSubmit}>
        <section className="admin-panel">
          <div className="admin-form-grid">
            <label className="field">Title<input name="title" required /></label>
            <label className="field">Company<input name="company" required /></label>
            <label className="field">Kind<select name="kind"><option value="job">Job</option><option value="internship">Internship</option></select></label>
            <label className="field">Sector<select name="sector"><option value="private">Private</option><option value="government">Government</option></select></label>
            <label className="field">Work mode<select name="mode"><option value="hybrid">Hybrid</option><option value="remote">Remote</option><option value="on_site">On site</option></select></label>
            <label className="field">Location<input name="location" /></label>
            <label className="field">Batch<input name="batch" placeholder="2025/2026/2027" /></label>
            <label className="field">Duration<input name="duration" placeholder="6 months" /></label>
            <label className="field span-2">Summary<textarea name="summary" required rows={3} /></label>
            <label className="field span-2">Eligibility<textarea name="eligibility" rows={2} /></label>
            <label className="field span-2">Requirements<textarea name="requirements" rows={4} /></label>
            <label className="field span-2">Responsibilities<textarea name="responsibilities" rows={3} /></label>
          </div>
        </section>
        <section className="admin-panel">
          <div className="admin-form-grid">
            <label className="field">Pay type<select name="compensationType"><option value="not_disclosed">Not disclosed</option><option value="stipend">Stipend</option><option value="salary">Salary</option></select></label>
            <label className="field">Pay label<input name="payDisplay" placeholder="₹30,000/month" /></label>
            <label className="field">Min rupees<input name="payMin" /></label>
            <label className="field">Max rupees<input name="payMax" /></label>
            <label className="field">Period<select name="period"><option value="monthly">Monthly</option><option value="annual">Annual</option></select></label>
            <label className="field">Tier<select name="tier"><option value="free">Free</option><option value="pro">Pro</option></select></label>
          </div>
        </section>
        <section className="admin-panel">
          <div className="admin-form-grid">
            <label className="field">Method<select name="applicationMethod"><option value="url">URL</option><option value="email">Email</option><option value="both">Both</option></select></label>
            <label className="field">Apply URL<input name="applicationUrl" type="url" /></label>
            <label className="field">HR email<input name="hrEmail" type="email" /></label>
            <label className="field">Subject<input name="emailSubject" /></label>
            <label className="field span-2">Apply note<input name="applyNote" /></label>
            <label className="checks span-2"><input type="checkbox" name="hrApproved" value="yes" /> HR email approved</label>
            <label className="field span-2">Source URL<input name="sourceUrl" type="url" required /></label>
            <label className="field span-2">Evidence<textarea name="evidence" required rows={3} /></label>
          </div>
        </section>
        <div className="admin-form-actions">
          <button className="btn-ghost" type="submit" disabled={loading}>Save draft</button>
          <button className="btn-primary" name="publish" value="yes" type="submit" disabled={loading}>Save and publish</button>
        </div>
      </form>
    </div>
  );
}
