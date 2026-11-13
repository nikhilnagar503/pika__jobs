import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { invalidateCached } from "@/lib/feed-cache";

type AdminJob = {
  jobId: string;
  version: number;
  title: string;
  companyName: string;
  summary: string;
  opportunityKind: string;
  sector: string;
  workMode: string;
  locationLabel: string;
  batchLabel: string | null;
  durationLabel: string | null;
  requirements: string[];
  eligibility: string[];
  responsibilities: string[];
  payDisplayLabel: string | null;
  compensationType: string;
  payMinMinor: number | null;
  payMaxMinor: number | null;
  payPeriod: string | null;
  applicationMethod: string;
  applicationUrl: string | null;
  hrEmail: string | null;
  emailSubject: string | null;
  hrEmailApproved: boolean;
  applyNote: string | null;
  sourceUrl: string;
  accessTier: "free" | "pro";
  lifecycle: string;
  evidence: Array<{ excerpt: string }>;
};

export function AdminEditJobPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<AdminJob | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canPublish = job?.lifecycle === "draft" || job?.lifecycle === "in_review";

  useEffect(() => {
    setLoading(true);
    api<{ job: AdminJob }>(`/api/v1/admin/jobs/${id}`)
      .then((body) => setJob(body.job))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load job."))
      .finally(() => setLoading(false));
  }, [id]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!job) return;
    setSaving(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const publish = form.get("publish") === "yes";
    const body = {
      expectedVersion: job.version,
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
      sourceUrl: String(form.get("sourceUrl") || job.sourceUrl),
      evidenceExcerpt: String(form.get("evidence") || job.evidence[0]?.excerpt || job.summary),
      accessTier: form.get("tier") === "pro" ? "pro" : "free",
      publish,
    };
    try {
      const result = await api<{ jobId: string; version: number; lifecycle: string }>(
        `/api/v1/admin/jobs/${job.jobId}`,
        { method: "PUT", body: JSON.stringify(body) },
      );
      setMessage(`Saved · ${result.lifecycle}`);
      if (result.lifecycle === "published") {
        invalidateCached("member-feed:");
        invalidateCached("admin-feed");
      }
      const refreshed = await api<{ job: AdminJob }>(`/api/v1/admin/jobs/${job.jobId}`);
      setJob(refreshed.job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save listing.");
    } finally {
      setSaving(false);
    }
  }

  async function publishNow() {
    if (!job) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const published = await api<{ jobId: string; lifecycle: string }>(
        `/api/v1/admin/jobs/${job.jobId}/publish`,
        { method: "POST" },
      );
      setMessage(`Published · ${published.lifecycle}`);
      invalidateCached("member-feed:");
      invalidateCached("admin-feed");
      const refreshed = await api<{ job: AdminJob }>(`/api/v1/admin/jobs/${job.jobId}`);
      setJob(refreshed.job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish listing.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteJob() {
    if (!job) return;
    const ok = window.confirm(`Delete "${job.title}"?`);
    if (!ok) return;
    setSaving(true);
    try {
      await api(`/api/v1/admin/jobs/${job.jobId}/delete`, { method: "POST" });
      navigate("/admin/feed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete listing.");
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">Loading job…</p>;
  if (!job) return <p className="error">{error || "Job not found."}</p>;

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Edit job</h1>
          <p className="muted">{job.companyName} · {job.lifecycle} · v{job.version}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn-ghost" to="/admin/feed">Back to feed</Link>
          {canPublish && (
            <button className="btn-primary" type="button" onClick={publishNow} disabled={saving}>
              {saving ? "Publishing…" : "Publish to feed"}
            </button>
          )}
          <button className="btn-danger" type="button" onClick={deleteJob} disabled={saving}>
            Delete
          </button>
        </div>
      </header>
      {message && <p className="notice">{message}</p>}
      {error && <p className="error">{error}</p>}
      <form className="admin-form" onSubmit={onSubmit}>
        <section className="admin-panel">
          <div className="admin-form-grid">
            <label className="field">Title<input name="title" required defaultValue={job.title} /></label>
            <label className="field">Company<input name="company" required defaultValue={job.companyName} /></label>
            <label className="field">
              Kind
              <select name="kind" defaultValue={job.opportunityKind}>
                <option value="job">Job</option>
                <option value="internship">Internship</option>
                <option value="apprenticeship">Apprenticeship</option>
                <option value="freelance">Freelance</option>
                <option value="fellowship">Fellowship</option>
              </select>
            </label>
            <label className="field">
              Sector
              <select name="sector" defaultValue={job.sector}>
                <option value="private">Private</option>
                <option value="government">Government</option>
              </select>
            </label>
            <label className="field">
              Work mode
              <select name="mode" defaultValue={job.workMode}>
                <option value="hybrid">Hybrid</option>
                <option value="remote">Remote</option>
                <option value="on_site">On site</option>
                <option value="field">Field</option>
                <option value="not_stated">Not stated</option>
              </select>
            </label>
            <label className="field">Location<input name="location" defaultValue={job.locationLabel} /></label>
            <label className="field">Batch<input name="batch" defaultValue={job.batchLabel ?? ""} /></label>
            <label className="field">Duration<input name="duration" defaultValue={job.durationLabel ?? ""} /></label>
            <label className="field span-2">Summary<textarea name="summary" required rows={3} defaultValue={job.summary} /></label>
            <label className="field span-2">Eligibility<textarea name="eligibility" rows={2} defaultValue={(job.eligibility ?? []).join("\n")} /></label>
            <label className="field span-2">Requirements<textarea name="requirements" rows={4} defaultValue={(job.requirements ?? []).join("\n")} /></label>
            <label className="field span-2">Responsibilities<textarea name="responsibilities" rows={3} defaultValue={(job.responsibilities ?? []).join("\n")} /></label>
          </div>
        </section>
        <section className="admin-panel">
          <div className="admin-form-grid">
            <label className="field">
              Pay type
              <select name="compensationType" defaultValue={job.compensationType}>
                <option value="not_disclosed">Not disclosed</option>
                <option value="stipend">Stipend</option>
                <option value="salary">Salary</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </label>
            <label className="field">Pay label<input name="payDisplay" defaultValue={job.payDisplayLabel ?? ""} /></label>
            <label className="field">Min rupees<input name="payMin" defaultValue={job.payMinMinor != null ? String(job.payMinMinor / 100) : ""} /></label>
            <label className="field">Max rupees<input name="payMax" defaultValue={job.payMaxMinor != null ? String(job.payMaxMinor / 100) : ""} /></label>
            <label className="field">
              Period
              <select name="period" defaultValue={job.payPeriod ?? "monthly"}>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="weekly">Weekly</option>
                <option value="hourly">Hourly</option>
              </select>
            </label>
            <label className="field">
              Tier
              <select name="tier" defaultValue={job.accessTier}>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
              </select>
            </label>
          </div>
        </section>
        <section className="admin-panel">
          <div className="admin-form-grid">
            <label className="field">
              Method
              <select name="applicationMethod" defaultValue={job.applicationMethod}>
                <option value="url">URL</option>
                <option value="email">Email</option>
                <option value="both">Both</option>
              </select>
            </label>
            <label className="field">Apply URL<input name="applicationUrl" type="url" defaultValue={job.applicationUrl ?? ""} /></label>
            <label className="field">HR email<input name="hrEmail" type="email" defaultValue={job.hrEmail ?? ""} /></label>
            <label className="field">Subject<input name="emailSubject" defaultValue={job.emailSubject ?? ""} /></label>
            <label className="field span-2">Apply note<input name="applyNote" defaultValue={job.applyNote ?? ""} /></label>
            <label className="checks span-2">
              <input type="checkbox" name="hrApproved" value="yes" defaultChecked={job.hrEmailApproved} /> HR email approved
            </label>
            <label className="field span-2">Source URL<input name="sourceUrl" type="url" defaultValue={job.sourceUrl} required /></label>
            <label className="field span-2">Evidence<textarea name="evidence" required rows={3} defaultValue={job.evidence[0]?.excerpt || job.summary} /></label>
          </div>
        </section>
        <div className="admin-form-actions">
          <button className="btn-ghost" type="submit" disabled={saving}>Save changes</button>
          <button className="btn-primary" name="publish" value="yes" type="submit" disabled={saving}>
            Save and publish
          </button>
        </div>
      </form>
    </div>
  );
}
