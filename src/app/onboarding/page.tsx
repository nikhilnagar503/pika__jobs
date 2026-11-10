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
      <p className="eyebrow">Step {step} of 3</p>
      <h1>{step === 1 ? "What are you looking for?" : step === 2 ? "How do you want to work?" : "Fine-tune your feed"}</h1>
      <p className="muted">Tap the cards that fit. You can skip anything.</p>
      <form action={saveOnboarding} className="onboard">
        <input type="hidden" name="step" value={step} />
        <input type="hidden" name="complete" value={step === 3 ? "yes" : "no"} />

        {step === 1 && (
          <>
            <section className="onboard-block">
              <h2>Opportunity type</h2>
              <div className="choice-grid">
                {opportunityKinds.map((item) => (
                  <label key={item.slug} className="choice-card">
                    <input type="checkbox" name="kinds" value={item.slug} defaultChecked={prefs.opportunityKinds.includes(item.slug)} />
                    <span className="choice-title">{item.label}</span>
                    <span className="choice-copy">Include these in ranking suggestions.</span>
                  </label>
                ))}
              </div>
            </section>
            <section className="onboard-block">
              <h2>Sector</h2>
              <div className="choice-grid two">
                <label className="choice-card">
                  <input type="checkbox" name="sectors" value="private" defaultChecked={prefs.sectors.includes("private")} />
                  <span className="choice-title">Private</span>
                  <span className="choice-copy">Companies and startups.</span>
                </label>
                <label className="choice-card">
                  <input type="checkbox" name="sectors" value="government" defaultChecked={prefs.sectors.includes("government")} />
                  <span className="choice-title">Government</span>
                  <span className="choice-copy">Public sector and related openings.</span>
                </label>
              </div>
            </section>
            <section className="onboard-block">
              <h2>Role families</h2>
              <div className="choice-grid">
                {roleFamilies.slice(0, 8).map((item) => (
                  <label key={item.slug} className="choice-card">
                    <input type="checkbox" name="roles" value={item.slug} defaultChecked={prefs.roleFamilySlugs.includes(item.slug)} />
                    <span className="choice-title">{item.label}</span>
                  </label>
                ))}
              </div>
              <label className="field" style={{ marginTop: 16 }}>
                Other, saved as a suggestion
                <textarea name="other" maxLength={80} defaultValue={prefs.otherRoleNote} />
              </label>
            </section>
          </>
        )}

        {step === 2 && (
          <>
            <section className="onboard-block">
              <h2>Your stage</h2>
              <div className="choice-grid two">
                {stages.map((item) => (
                  <label key={item} className="choice-card">
                    <input type="radio" name="stage" value={item} defaultChecked={prefs.stage === item} />
                    <span className="choice-title">{item}</span>
                  </label>
                ))}
              </div>
            </section>
            <section className="onboard-block">
              <h2>Experience</h2>
              <div className="choice-grid two">
                {experienceBands.map((item) => (
                  <label key={item.slug} className="choice-card">
                    <input type="radio" name="experience" value={item.slug} defaultChecked={prefs.experienceBand === item.slug} />
                    <span className="choice-title">{item.label}</span>
                  </label>
                ))}
              </div>
            </section>
            <section className="onboard-block">
              <h2>Work mode</h2>
              <div className="choice-grid two">
                {workModes.filter((item) => item.slug !== "not_stated").map((item) => (
                  <label key={item.slug} className="choice-card">
                    <input type="checkbox" name="modes" value={item.slug} defaultChecked={prefs.workModes.includes(item.slug)} />
                    <span className="choice-title">{item.label}</span>
                  </label>
                ))}
              </div>
            </section>
            <div className="grid-2" style={{ marginTop: 8 }}>
              <label className="field">Location<input name="location" defaultValue={prefs.locationLabel} placeholder="City or region" /></label>
              <label className="field">Country<input name="country" defaultValue={prefs.countryCode || "IN"} /></label>
            </div>
          </>
        )}

        {step === 3 && (
          <section className="onboard-block">
            <h2>Skills and pay visibility</h2>
            <label className="field">
              Skills, comma separated, up to 10
              <input name="skills" defaultValue={prefs.skillSlugs.join(", ")} placeholder="React, SQL, Figma" />
            </label>
            <label className="choice-card" style={{ display: "grid" }}>
              <input type="checkbox" name="unknownPay" value="yes" defaultChecked={prefs.showUnknownPay} />
              <span className="choice-title">Show opportunities without disclosed pay</span>
              <span className="choice-copy">Unknown pay stays unknown. Unpaid roles stay labeled unpaid.</span>
            </label>
          </section>
        )}

        <div className="cluster onboard-actions">
          {step > 1 && <a className="btn-ghost" href={`/onboarding?step=${step - 1}`}>Back</a>}
          <button className="btn-ghost" type="submit" formNoValidate>Skip</button>
          <button className="btn-primary" type="submit">{step === 3 ? "Open feed" : "Continue"}</button>
        </div>
      </form>
    </MemberShell>
  );
}
