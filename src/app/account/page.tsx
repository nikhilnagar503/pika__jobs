import { redirect } from "next/navigation";
import { MemberShell } from "@/components/member-shell";
import { signOut } from "@/server/actions";
import { readActor } from "@/server/auth/session";
import { withStore } from "@/server/repositories/file-store";

export const metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  const account = await withStore(async (store) => {
    const actor = await readActor(store);
    if (actor.kind !== "user") return null;
    return store.account(actor);
  });
  if (!account) redirect("/auth/sign-in?next=/account");
  return (
    <MemberShell current="/account">
      <h1>Account</h1>
      {query.error && <p className="error">{query.error}</p>}
      <p>{account.displayName}</p>
      <p className="muted">{account.email}</p>
      <p>Country: {account.countryCode}</p>
      <p>Pro access until: {account.proUntil ? new Date(account.proUntil).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "No active pass"}</p>
      <p className="muted">Roles cannot be changed from this page. {account.roles.length ? account.roles.join(", ") : "Member"}</p>
      {account.roles.includes("admin") && <p><a href="/admin">Open admin workspace</a></p>}
      <form action={signOut}><button className="btn-ghost" type="submit">Sign out</button></form>
    </MemberShell>
  );
}
