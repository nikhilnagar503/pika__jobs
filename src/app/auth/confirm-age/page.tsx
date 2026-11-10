import { confirmAdult } from "@/server/actions";
import { SiteHeader } from "@/components/site-header";
import { readActor } from "@/server/auth/session";
import { withStore } from "@/server/repositories/file-store";
import { redirect } from "next/navigation";

export const metadata = { title: "Confirm your age" };

export default async function ConfirmAgePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const actor = await withStore(async (store) => readActor(store));
  if (actor.kind !== "user") redirect("/auth/sign-in?next=/auth/confirm-age");
  return (
    <>
      <SiteHeader signedIn />
      <main id="main" className="wrap section" style={{ maxWidth: 560 }}>
        <h1>Confirm you are 18 or older</h1>
        <p className="muted">Pikajobs is for adults. Confirm once to continue to the feed.</p>
        {query.error && <p className="error">{query.error}</p>}
        <form action={confirmAdult}>
          <label className="checks">
            <input type="checkbox" name="adult" value="yes" required /> I am 18 or older
          </label>
          <button className="btn-primary" type="submit">
            Continue
          </button>
        </form>
      </main>
    </>
  );
}
