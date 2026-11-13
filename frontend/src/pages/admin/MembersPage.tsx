import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatRelativeTime } from "@/lib/time";

type Member = {
  userId: string;
  email: string;
  displayName: string;
  createdAt: string;
  deletedAt: string | null;
  roles: string[];
  suspended: boolean;
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function AdminMembersPage() {
  const [items, setItems] = useState<Member[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ items: Member[] }>("/api/v1/admin/users")
      .then((body) => {
        const sorted = [...body.items].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setItems(sorted);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load members."));
  }, []);

  const active = items.filter((user) => !user.deletedAt);

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Members</h1>
          <p className="muted">
            This is the number of people who signed up. It includes you, any seed/demo account, and every student account.
          </p>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="import-count-grid">
        <div className="import-count is-ready">
          <strong>{active.length}</strong>
          <span>Signed up</span>
        </div>
        <div className="import-count">
          <strong>{items.filter((user) => user.roles.includes("admin")).length}</strong>
          <span>Admin accounts</span>
        </div>
        <div className="import-count">
          <strong>{active.filter((user) => !user.roles.includes("admin")).length}</strong>
          <span>Student accounts</span>
        </div>
        <div className="import-count">
          <strong>{items.filter((user) => user.deletedAt).length}</strong>
          <span>Deleted accounts</span>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Signed up</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {items.map((user) => (
              <tr key={user.userId}>
                <td>
                  <strong>{user.displayName || "—"}</strong>
                  {user.deletedAt && <div className="meta">Account deleted</div>}
                  {user.suspended && <div className="meta">Suspended</div>}
                </td>
                <td>{user.email}</td>
                <td>
                  {formatWhen(user.createdAt)}
                  <div className="meta">{formatRelativeTime(user.createdAt)}</div>
                </td>
                <td>{user.roles.length ? user.roles.join(", ") : "member"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length === 0 && !error && <p className="muted">No members yet.</p>}
    </div>
  );
}
