import { saveCampaignAction } from "@/server/actions";
import { readActor } from "@/server/auth/session";
import { withStore } from "@/server/repositories/file-store";

export const metadata = { title: "Ads" };

export default async function AdsPage() {
  const campaigns = await withStore(async (store) => {
    const actor = await readActor(store);
    if (actor.kind !== "user" || !actor.roles.includes("admin")) return null;
    return store.listCampaigns(actor);
  });
  if (!campaigns) return <p>This module is limited to an admin.</p>;
  return (
    <>
      <h1>Ads</h1>
      <p>A sponsored card is inserted after every 10 organic jobs. Pro members do not receive it. Leave this empty until a real sponsor exists.</p>
      {campaigns.map((item) => <p key={item.id}>{item.name} · {item.active ? "active" : "inactive"}</p>)}
      <form action={saveCampaignAction} className="panel">
        <label className="field">Name<input name="name" required /></label>
        <label className="field">Destination URL<input name="url" type="url" required /></label>
        <label className="field">Starts<input name="starts" type="datetime-local" required /></label>
        <label className="field">Ends<input name="ends" type="datetime-local" required /></label>
        <label className="checks"><input type="checkbox" name="active" value="yes" /> Active</label>
        <button className="btn-primary" type="submit">Save campaign</button>
      </form>
    </>
  );
}
