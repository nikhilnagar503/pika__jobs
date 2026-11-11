import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";

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
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [payload, setPayload] = useState<unknown>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    setResult(null);
    setPreviewCount(null);
    setPayload(null);
    const file = event.target.files?.[0];
    if (!file) {
      setFileName("");
      return;
    }
    setFileName(file.name);
    try {
      const text = await file.text();
      const json = JSON.parse(text) as Record<string, unknown>;
      const count =
        (Array.isArray(json.jobs) ? json.jobs.length : 0) +
        (Array.isArray(json.telegram_jobs) ? json.telegram_jobs.length : 0) +
        (Array.isArray(json.scraped_jobs) ? json.scraped_jobs.length : 0);
      if (!count) {
        throw new Error("No jobs array found. Use files with jobs, telegram_jobs, or scraped_jobs.");
      }
      setPayload(json);
      setPreviewCount(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read JSON file.");
      setFileName("");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!payload) {
      setError("Choose a JSON file first.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    const form = new FormData(event.currentTarget);
    const publish = form.get("publish") === "yes";
    try {
      const body = await api<ImportResult>("/api/v1/admin/jobs/import", {
        method: "POST",
        body: JSON.stringify({ payload, publish }),
      });
      setResult(body);
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
          <p className="muted">
            Upload catalog files (`jobs`) or tracker files (`telegram_jobs` / `scraped_jobs`).
          </p>
        </div>
        <Link className="btn-ghost" to="/admin/jobs">Back</Link>
      </header>

      {error && <p className="error">{error}</p>}

      <form className="admin-form" onSubmit={onSubmit}>
        <section className="admin-panel">
          <label className="field">
            JSON file
            <input type="file" accept="application/json,.json" onChange={onFileChange} />
          </label>
          {fileName && (
            <p className="meta">
              Selected: {fileName}
              {previewCount != null ? ` · ${previewCount} listings detected` : ""}
            </p>
          )}
          <label className="checks">
            <input type="checkbox" name="publish" value="yes" defaultChecked />
            Publish imported listings to the feed immediately
          </label>
          <p className="muted">
            Every row with a title, company, and apply link is mapped into a Pikajobs listing.
          </p>
          <button className="btn-primary" type="submit" disabled={loading || !payload}>
            {loading ? "Importing…" : "Import jobs"}
          </button>
        </section>
      </form>

      {result && (
        <section className="admin-panel" style={{ marginTop: 24 }}>
          <h2>Import result</h2>
          <p className="meta">
            Format: {result.format}
            {result.category ? ` · ${result.category}` : ""}
            {result.generatedDate ? ` · ${result.generatedDate}` : ""}
          </p>
          <p>
            Created <strong>{result.createdCount}</strong>
            {" · "}
            Skipped <strong>{result.skippedCount}</strong>
            {" · "}
            Failed <strong>{result.failedCount}</strong>
            {result.publish ? " · published" : " · saved as drafts"}
          </p>
          {result.failed.length > 0 && (
            <div>
              <h3>Failed</h3>
              <ul>
                {result.failed.slice(0, 20).map((item) => (
                  <li key={item.importKey}>
                    {item.importKey}: {item.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.skipped.length > 0 && (
            <div>
              <h3>Skipped</h3>
              <ul>
                {result.skipped.slice(0, 20).map((item) => (
                  <li key={`${item.key}-${item.reason}`}>
                    {item.key}: {item.reason}
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
