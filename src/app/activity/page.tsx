import { redirect } from "next/navigation";
import { MemberShell } from "@/components/member-shell";
import { readActor } from "@/server/auth/session";
import { withStore } from "@/server/repositories/file-store";

export const metadata = { title: "Activity" };

export default async function ActivityPage() {
  const items = await withStore(async (store) => {
    const actor = await readActor(store);
    if (actor.kind !== "user") return null;
    return store.listActivity(actor);
  });
  if (!items) redirect("/auth/sign-in?next=/activity");
  return (
    <MemberShell current="/activity">
      <h1>Activity</h1>
      <p className="muted">Opened application means you opened the employer route. Applied is only what you mark yourself.</p>
      {items.length === 0 && <p>No activity yet.</p>}
      <ul>{items.map((item) => <li key={item.id}>{item.kind === "opened" ? "Opened application" : "Marked as applied"} · {item.title}</li>)}</ul>
    </MemberShell>
  );
}
