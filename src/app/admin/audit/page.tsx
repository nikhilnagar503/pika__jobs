import { readActor } from "@/server/auth/session";
import { withStore } from "@/server/repositories/file-store";

export const metadata = { title: "Audit" };

export default async function AuditPage() {
  const events = await withStore(async (store) => {
    const actor = await readActor(store);
    if (actor.kind !== "user" || !actor.roles.includes("admin")) return null;
    return store.listAudit(actor);
  });
  if (!events) return <p>This module is limited to an admin.</p>;
  return (
    <>
      <h1>Audit</h1>
      {events.length === 0 && <p className="muted">No audit events yet.</p>}
      {events.slice().reverse().map((event) => <p key={event.id} className="meta">{event.at} · {event.action} · {event.summary}</p>)}
    </>
  );
}
