import { readActor } from "@/server/auth/session";
import { withStore } from "@/server/repositories/file-store";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const users = await withStore(async (store) => {
    const actor = await readActor(store);
    if (actor.kind !== "user" || !actor.roles.includes("admin")) return null;
    return store.listUsers(actor);
  });
  if (!users) return <p>This module is limited to an admin.</p>;
  return (
    <>
      <h1>Users</h1>
      {users.map((user) => <p key={user.userId}>{user.email} · {user.roles.join(", ") || "member"} · {user.suspended ? "suspended" : "active"}</p>)}
    </>
  );
}
