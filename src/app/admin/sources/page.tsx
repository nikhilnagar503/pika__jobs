import { createCredentialAction, saveSourceAction } from "@/server/actions";
import { readActor } from "@/server/auth/session";
import { withStore } from "@/server/repositories/file-store";

export const metadata = { title: "Sources" };

export default async function SourcesPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const query = await searchParams;
  const data = await withStore(async (store) => {
    const actor = await readActor(store);
    return {
      sources: store.listSources(actor),
      credentials: actor.kind === "user" && actor.roles.includes("admin") ? store.listCredentials(actor) : [],
    };
  });
  return (
    <>
      <h1>Sources and agents</h1>
      {query.token && <p className="notice">Copy this token now. It will not be shown again: {query.token}</p>}
      {data.sources.map((source) => <p key={source.id}>{source.name} · {source.enabled ? "enabled" : "disabled"} · {source.permissionBasis || "No permission basis"}</p>)}
      <form action={saveSourceAction} className="panel">
        <h2>Register a source</h2>
        <label className="field">Name<input name="name" required /></label>
        <label className="field">Type<input name="type" defaultValue="employer" /></label>
        <label className="field">Domain<input name="domain" placeholder="careers.example.com" required /></label>
        <label className="field">Permission basis<textarea name="permission" required /></label>
        <label className="field">Board id<input name="boardId" /></label>
        <label className="checks"><input type="checkbox" name="enabled" value="yes" defaultChecked /> Enabled</label>
        <button className="btn-primary" type="submit">Save source</button>
      </form>
      <form action={createCredentialAction} className="panel">
        <h2>Create agent credential</h2>
        <label className="field">Name<input name="name" required /></label>
        <fieldset className="checks"><legend>Sources</legend>
          {data.sources.map((source) => <label key={source.id}><input type="checkbox" name="sourceIds" value={source.id} />{source.name}</label>)}
        </fieldset>
        <label className="checks"><input type="checkbox" name="scopes" value="jobs:submit" defaultChecked /> jobs:submit</label>
        <label className="checks"><input type="checkbox" name="scopes" value="batches:read:self" defaultChecked /> batches:read:self</label>
        <button className="btn-ghost" type="submit">Create credential</button>
      </form>
      {data.credentials.map((item) => <p key={item.id} className="meta">{item.name} · {item.prefix}… · {item.revokedAt ? "revoked" : "active"}</p>)}
    </>
  );
}
