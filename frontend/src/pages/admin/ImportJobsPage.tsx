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

type PreviewResult = {
  format: string;
  category: string | null;
  generatedDate: string | null;
  draftCount: number;
  skippedCount: number;
  drafts: ImportDraft[];
  skipped: Array<{ key: string; reason: string }>;
};

type ImportResult = {
  format: string;
  category: string | null;
  generatedDate: string | null;
  publish: boolean;
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  created: Array<{ importKey: string; jobId: string; lifecycle: string }>;
  skipped: Array<{ key: string; reason: string }>;
  failed: Array<{ importKey: string; message: string }>;
};

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
        setError("No importable jobs found in this file.");
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
      const body = await api<ImportResult>("/api/v1/admin/jobs/import", {
        method: "POST",
        body: JSON.stringify({
          drafts,
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

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Import jobs JSON</h1>
          <p className="muted">Upload a file, review the preview, edit or remove rows, then post.</p>
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
          <div className="admin-header" style={{ marginBottom: 12 }}>
            <div>
              <h2>Preview · {drafts.length} jobs</h2>
              <p className="meta">
                Format: {preview.format}
                {preview.category ? ` · ${preview.category}` : ""}
                {preview.generatedDate ? ` · ${preview.generatedDate}` : ""}
                {preview.skippedCount ? ` · ${preview.skippedCount} skipped (duplicates or incomplete)` : ""}
              </p>
              <p className="muted">Same company + title cannot appear twice in the live 14-day feed.</p>
            </div>
            <button className="btn-primary" type="button" onClick={confirmImport} disabled={loading || drafts.length === 0}>
              {loading ? "Posting…" : `Post ${drafts.length} jobs`}
            </button>
          </div>

          {drafts.length > 0 && (
            <>
              <div className="import-preview-list">
                {drafts.map((draft, index) => (
                  <article key={draft.importKey} className="import-preview-card">
                    <div className="import-preview-top">
                      <span className="meta">{draft.opportunityKind}</span>
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

              <button className="btn-primary" type="button" onClick={confirmImport} disabled={loading} style={{ marginTop: 16 }}>
                {loading ? "Posting…" : `Post ${drafts.length} jobs`}
              </button>
            </>
          )}

          {preview.skipped.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3>Skipped</h3>
              <ul>
                {preview.skipped.slice(0, 30).map((item) => (
                  <li key={`${item.key}-${item.reason}`}>
                    {item.key}: {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {result && (
        <section className="admin-panel" style={{ marginTop: 24 }}>
          <h2>Import result</h2>
          <p>
            Created <strong>{result.createdCount}</strong>
            {" · "}
            Failed <strong>{result.failedCount}</strong>
            {result.publish ? " · published" : " · saved as drafts"}
          </p>
          {result.failed.length > 0 && (
            <ul>
              {result.failed.slice(0, 20).map((item) => (
                <li key={item.importKey}>
                  {item.importKey}: {item.message}
                </li>
              ))}
            </ul>
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
