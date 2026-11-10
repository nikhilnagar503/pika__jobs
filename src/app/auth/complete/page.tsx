import { redirect } from "next/navigation";
import { readActor } from "@/server/auth/session";
import { withStore } from "@/server/repositories/file-store";

export const metadata = { title: "Finishing sign-in" };

export default async function AuthCompletePage() {
  const destination = await withStore(async (store) => {
    const actor = await readActor(store);
    if (actor.kind !== "user") return "/auth/sign-in";
    const user = store.db.users.find((item) => item.userId === actor.userId);
    if (!user?.adultConfirmed) return "/auth/confirm-age";
    if (!user.onboardingCompleted && user.onboardingStep < 3) return "/onboarding";
    return "/feed";
  });
  redirect(destination);
}
