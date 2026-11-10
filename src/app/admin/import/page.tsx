export const metadata = { title: "Import" };

export default function ImportPage() {
  return (
    <>
      <h1>Import</h1>
      <p>JSON batches use <code>contracts/job-batch.schema.json</code>. CSV and pasted text enter the same validation service through <code>POST /api/v1/ingestion/jobs</code>. There is no extraction provider configured, so pasted text stays a manual draft instead of a pretended AI result.</p>
      <p className="muted">Dry run: <code>POST /api/v1/ingestion/dry-run</code> with an Idempotency-Key. A dry run writes nothing.</p>
    </>
  );
}
