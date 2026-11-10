import { redirect } from "next/navigation";
import { MemberShell } from "@/components/member-shell";
import { saveOnboarding } from "@/server/actions";
import { readActor } from "@/server/auth/session";
import { experienceBands, opportunityKinds, roleFamilies, stages, workModes } from "@/shared/product";
import { withStore } from "@/server/repositories/file-store";

export const metadata = { title: "Onboarding" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const query = await searchParams;
  const step = Math.min(3, Math.max(1, Number(query.step ?? 1)));
  const prefs = await withStore(async (store) => {
    const actor = await readActor(store);
    if (actor.kind !== "user") return null;
    return store.getPreferences(actor);
  });
  if (!prefs) redirect("/auth/sign-in?next=/onboarding");
  return (
    <MemberShell current="/onboarding">
      <h1>Improve your feed</h1>
      <p className="muted">Step {step} of 3. You can skip every question.</p>
      <form action={saveOnboarding}>
        <input type="hidden" name="step" value={step} />
        <input type="hidden" name="complete" value={step === 3 ? "yes" : "no"} />
        {step === 1 && (
          <>
            <fieldset className="checks"><legend>What are you looking for?</legend>
              {opportunityKinds.map((item) => <label key={item.slug}><input type="checkbox" name="kinds" value={item.slug} defaultChecked={prefs.opportunityKinds.includes(item.slug)} />{item.label}</label>)}
            </fieldset>
            <fieldset className="checks"><legend>Sector</legend>
              <label><input type="checkbox" name="sectors" value="private" />Private</label>
              <label><input type="checkbox" name="sectors" value="government" />Government or public sector</label>
            </fieldset>
            <fieldset className="checks"><legend>Role families</legend>
              {roleFamilies.slice(0, 8).map((item) => <label key={item.slug}><input type="checkbox" name="roles" value={item.slug} defaultChecked={prefs.roleFamilySlugs.includes(item.slug)} />{item.label}</label>)}
            </fieldset>
            <label className="field">Other, saved as a suggestion<textarea name="other" maxLength={80} defaultValue={prefs.otherRoleNote} /></label>
          </>
        )}
        {step === 2 && (
          <>
            <label className="field">Current stage
              <select name="stage" defaultValue={prefs.stage}><option value="">Skip</option>{stages.map((item) => <option key={item}>{item}</option>)}</select>
            </label>
            <label className="field">Experience
              <select name="experience" defaultValue={prefs.experienceBand}><option value="">Skip</option>{experienceBands.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}</select>
            </label>
            <fieldset className="checks"><legend>Work preference</legend>
              {workModes.filter((item) => item.slug !== "not_stated").map((item) => <label key={item.slug}><input type="checkbox" name="modes" value={item.slug} defaultChecked={prefs.workModes.includes(item.slug)} />{item.label}</label>)}
            </fieldset>
            <label className="field">Location<input name="location" defaultValue={prefs.locationLabel} /></label>
            <label className="field">Country<input name="country" defaultValue={prefs.countryCode || "IN"} /></label>
          </>
        )}
        {step === 3 && (
          <>
            <label className="field">Skills, comma separated, up to 10<input name="skills" defaultValue={prefs.skillSlugs.join(", ")} /></label>
            <label className="checks"><input type="checkbox" name="unknownPay" value="yes" defaultChecked={prefs.showUnknownPay} /> Show opportunities without disclosed pay</label>
          </>
        )}
        <div className="cluster">
          {step > 1 && <a className="btn-ghost" href={`/onboarding?step=${step - 1}`}>Back</a>}
          <button className="btn-ghost" type="submit" formNoValidate>Skip</button>
          <button className="btn-primary" type="submit">{step === 3 ? "Open feed" : "Continue"}</button>
        </div>
      </form>
    </MemberShell>
  );
}
