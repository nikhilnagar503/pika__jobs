import { useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";

type ImportDraft = {
  importKey: string;
  title: string;
  companyName: string;
  summary: string;
  opportunityKind: string;
  locationLabel: string;
  payDisplayLabel: string | null;
  applicationUrl: string | null;
  hrEmail: string | null;
  batchLabel: string | null;
  durationLabel: string | null;
  skills: string[];
  eligibility: string[];
  requirements: string[];
  [key: string]: unknown;
};

type ImportSkip = {
  key: string;
  company: string;
  title: string;
  reason: string;
};

type PreviewResult = {
  format: string;
  category: string | null;
  generatedDate: string | null;
  totalCount: number;
  draftCount: number;
  skippedCount: number;
  drafts: ImportDraft[];
  skipped: ImportSkip[];
};

type ImportResult = {
  format: string;
  category: string | null;
  generatedDate: string | null;
  totalCount: number;
  publish: boolean;
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  created: Array<{ importKey: string; jobId: string; lifecycle: string; companyName: string; title: string }>;
  skipped: ImportSkip[];
  failed: Array<{ importKey: string; companyName: string; title: string; message: string }>;
};

function jobLabel(company: string, title: string) {
  return `${company || "Unknown company"} · ${title || "Untitled role"}`;
}

export function AdminImportJobsPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [publish, setPublish] = useState(true);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [drafts, setDrafts] = useState<ImportDraft[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    setResult(null);
    setPreview(null);
    setDrafts([]);
    const file = event.target.files?.[0];
    if (!file) {
      setFileName("");
      return;
    }
    setFileName(file.name);
    setLoading(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      const body = await api<PreviewResult>("/api/v1/admin/jobs/import/preview", {
        method: "POST",
        body: JSON.stringify({ payload }),
      });
      setPreview(body);
      setDrafts(body.drafts);
      if (!body.drafts.length) {
        setError("None of these jobs can be posted yet. Check the blocked list below.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read JSON file.");
      setFileName("");
    } finally {
      setLoading(false);
    }
  }

  function updateDraft(index: number, patch: Partial<ImportDraft>) {
    setDrafts((current) => current.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));
  }

  function removeDraft(index: number) {
    setDrafts((current) => current.filter((_, i) => i !== index));
  }

  async function confirmImport() {
    if (!drafts.length) {
      setError("Keep at least one job in the preview.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const kept = new Set(drafts.map((draft) => draft.importKey));
      const removed = (preview?.drafts ?? [])
        .filter((draft) => !kept.has(draft.importKey))
        .map((draft) => ({
          key: draft.importKey,
          company: draft.companyName,
          title: draft.title,
          reason: "Removed from this upload before posting.",
        }));
      const body = await api<ImportResult>("/api/v1/admin/jobs/import", {
        method: "POST",
        body: JSON.stringify({
          drafts,
          skipped: [...(preview?.skipped ?? []), ...removed],
          totalCount: preview?.totalCount ?? drafts.length + (preview?.skippedCount ?? 0) + removed.length,
          publish,
          format: preview?.format,
          category: preview?.category,
          generatedDate: preview?.generatedDate,
        }),
      });
      setResult(body);
      setDrafts([]);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setLoading(false);
    }
  }

  const fileTotal = preview?.totalCount ?? drafts.length + (preview?.skipped.length ?? 0);
  const blockedCount = preview?.skipped.length ?? 0;

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Import jobs JSON</h1>
          <p className="muted">Upload a file, review every job, then post. Posted, blocked, and failed rows stay visible with reasons.</p>
        </div>
        <Link className="btn-ghost" to="/admin/jobs">Back</Link>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="admin-panel">
        <label className="field">
          JSON file
          <input type="file" accept="application/json,.json" onChange={onFileChange} disabled={loading} />
        </label>
        {fileName && <p className="meta">Selected: {fileName}</p>}
        <label className="checks">
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
          Publish listings to the feed immediately
        </label>
      </section>

      {preview && (
        <section className="admin-panel" style={{ marginTop: 24 }}>
          <div className="admin-header" style={{ marginBottom: 4 }}>
            <div>
              <h2>Preview</h2>
              <p className="meta">
                Format: {preview.format}
                {preview.category ? ` · ${preview.category}` : ""}
                {preview.generatedDate ? ` · ${preview.generatedDate}` : ""}
              </p>
            </div>
            <button className="btn-primary" type="button" onClick={confirmImport} disabled={loading || drafts.length === 0}>
              {loading ? "Posting…" : `Post ${drafts.length} ready ${drafts.length === 1 ? "job" : "jobs"}`}
            </button>
          </div>

          <div className="import-count-grid">
            <div className="import-count">
              <strong>{fileTotal}</strong>
              <span>In this file</span>
            </div>
            <div className="import-count is-ready">
              <strong>{drafts.length}</strong>
              <span>Ready to post</span>
            </div>
            <div className="import-count is-blocked">
              <strong>{blockedCount}</strong>
              <span>Cannot post</span>
            </div>
            <div className="import-count">
              <strong>{Math.max(0, fileTotal - drafts.length - blockedCount)}</strong>
              <span>Removed</span>
            </div>
          </div>

          <p className="muted">Same company + title cannot appear twice in the live 14-day feed. Edit a ready card or remove it before posting.</p>

          {drafts.length > 0 && (
            <>
              <h3 className="import-section-title">Ready to post · {drafts.length}</h3>
              <div className="import-preview-list">
                {drafts.map((draft, index) => (
                  <article key={draft.importKey} className="import-preview-card">
                    <div className="import-preview-top">
                      <span className="import-status is-ready">Ready · {draft.opportunityKind}</span>
                      <button className="btn-ghost" type="button" onClick={() => removeDraft(index)}>
                        Remove
                      </button>
                    </div>
                    <label className="field">
                      Role
                      <input
                        value={draft.title}
                        onChange={(e) => updateDraft(index, { title: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      Company
                      <input
                        value={draft.companyName}
                        onChange={(e) => updateDraft(index, { companyName: e.target.value })}
                      />
                    </label>
                    <div className="import-preview-grid">
                      <label className="field">
                        Type
                        <select
                          value={draft.opportunityKind}
                          onChange={(e) => updateDraft(index, { opportunityKind: e.target.value })}
                        >
                          <option value="job">Job</option>
                          <option value="internship">Internship</option>
                          <option value="apprenticeship">Apprenticeship</option>
                          <option value="freelance">Freelance</option>
                          <option value="fellowship">Fellowship</option>
                        </select>
                      </label>
                      <label className="field">
                        Pay / stipend
                        <input
                          value={draft.payDisplayLabel ?? ""}
                          onChange={(e) => updateDraft(index, { payDisplayLabel: e.target.value || null })}
                        />
                      </label>
                      <label className="field">
                        Location
                        <input
                          value={draft.locationLabel}
                          onChange={(e) => updateDraft(index, { locationLabel: e.target.value })}
                        />
                      </label>
                      <label className="field">
                        Batch
                        <input
                          value={draft.batchLabel ?? ""}
                          onChange={(e) => updateDraft(index, { batchLabel: e.target.value || null })}
                        />
                      </label>
                    </div>
                    <label className="field">
                      Apply URL
                      <input
                        value={draft.applicationUrl ?? ""}
                        onChange={(e) => updateDraft(index, { applicationUrl: e.target.value || null })}
                      />
                    </label>
                    <label className="field">
                      HR email
                      <input
                        value={draft.hrEmail ?? ""}
                        onChange={(e) => updateDraft(index, { hrEmail: e.target.value || null })}
                      />
                    </label>
                    <label className="field">
                      Summary
                      <textarea
                        rows={2}
                        value={draft.summary}
                        onChange={(e) => updateDraft(index, { summary: e.target.value })}
                      />
                    </label>
                  </article>
                ))}
              </div>
            </>
          )}

          {preview.skipped.length > 0 && (
            <div>
              <h3 className="import-section-title">Cannot post · {preview.skipped.length}</h3>
              <p className="muted">These jobs will not go live until the reason below is fixed.</p>
              <ul className="import-report-list">
                {preview.skipped.map((item) => (
                  <li key={`${item.key}-${item.reason}`} className="import-report-item is-blocked">
                    <strong>{jobLabel(item.company, item.title)}</strong>
                    <span>{item.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {drafts.length > 0 && (
            <button className="btn-primary" type="button" onClick={confirmImport} disabled={loading} style={{ marginTop: 8 }}>
              {loading ? "Posting…" : `Post ${drafts.length} ready ${drafts.length === 1 ? "job" : "jobs"}`}
            </button>
          )}
        </section>
      )}

      {result && (
        <section className="admin-panel" style={{ marginTop: 24 }}>
          <h2>Import result</h2>
          <p className="meta">
            {result.publish ? "Published to the feed" : "Saved as drafts"}
            {fileName ? ` · ${fileName}` : ""}
          </p>
          <div className="import-count-grid">
            <div className="import-count">
              <strong>{result.totalCount || result.createdCount + result.skippedCount + result.failedCount}</strong>
              <span>In this file</span>
            </div>
            <div className="import-count is-ready">
              <strong>{result.createdCount}</strong>
              <span>Posted</span>
            </div>
            <div className="import-count is-blocked">
              <strong>{result.skippedCount}</strong>
              <span>Not posted</span>
            </div>
            <div className="import-count is-failed">
              <strong>{result.failedCount}</strong>
              <span>Failed</span>
            </div>
          </div>

          {result.created.length > 0 && (
            <div>
              <h3 className="import-section-title">Posted · {result.created.length}</h3>
              <ul className="import-report-list">
                {result.created.map((item) => (
                  <li key={item.jobId} className="import-report-item is-ready">
                    <strong>{jobLabel(item.companyName, item.title)}</strong>
                    <span>{item.lifecycle}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.skipped.length > 0 && (
            <div>
              <h3 className="import-section-title">Not posted · {result.skipped.length}</h3>
              <ul className="import-report-list">
                {result.skipped.map((item) => (
                  <li key={`${item.key}-${item.reason}`} className="import-report-item is-blocked">
                    <strong>{jobLabel(item.company, item.title)}</strong>
                    <span>{item.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.failed.length > 0 && (
            <div>
              <h3 className="import-section-title">Failed · {result.failed.length}</h3>
              <ul className="import-report-list">
                {result.failed.map((item) => (
                  <li key={item.importKey} className="import-report-item is-failed">
                    <strong>{jobLabel(item.companyName, item.title)}</strong>
                    <span>{item.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="muted">
            <Link to="/admin/jobs">Review jobs</Link>
            {" · "}
            <Link to="/feed">Open feed</Link>
          </p>
        </section>
      )}
    </div>
  );
}
