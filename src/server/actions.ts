"use server";

import { redirect } from "next/navigation";
import { clearSession, readActor, referralCookie, writeSession } from "@/server/auth/session";
import { AppError } from "@/server/http";
import { safeReturnPath } from "@/server/http";
import { withStore } from "@/server/repositories/file-store";
import type { JobInput } from "@/server/repositories/memory";

function fail(error: unknown): never {
  const message = error instanceof AppError ? error.message : "That action could not be completed.";
  redirect(`/account?error=${encodeURIComponent(message)}`);
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const displayName = String(formData.get("displayName") ?? "");
  const adult = formData.get("adult") === "yes";
  const next = safeReturnPath(String(formData.get("next") ?? "/onboarding"));
  try {
    const code = await referralCookie();
    const user = await withStore((store) =>
      store.createUser({ email, displayName, adultConfirmed: adult, referralCode: code }),
    );
    await writeSession(user.userId);
  } catch (error) {
    redirect(`/auth/sign-up?error=${encodeURIComponent(error instanceof AppError ? error.message : "Could not create the account.")}`);
  }
  redirect(next);
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeReturnPath(String(formData.get("next") ?? "/feed"));
  try {
    const userId = await withStore((store) => {
      const user = store.db.users.find((item) => item.email === email && !item.deletedAt);
      if (!user) throw new AppError(404, "not_found", "No local account uses that email yet.");
      return user.userId;
    });
    await writeSession(userId);
  } catch (error) {
    redirect(`/auth/sign-in?error=${encodeURIComponent(error instanceof AppError ? error.message : "Could not sign in.")}`);
  }
  redirect(next);
}

export async function signOut() {
  await clearSession();
  redirect("/");
}

export async function saveOnboarding(formData: FormData) {
  const step = Number(formData.get("step") ?? 1);
  const complete = formData.get("complete") === "yes";
  try {
      await withStore(async (store) => {
      const actor = await readActor(store);
      const patch: {
        step: number;
        complete?: boolean;
        opportunityKinds?: string[];
        sectors?: string[];
        roleFamilySlugs?: string[];
        otherRoleNote?: string;
        workModes?: string[];
        locationLabel?: string;
        countryCode?: string;
        experienceBand?: string;
        stage?: string;
        skillSlugs?: string[];
        showUnknownPay?: boolean;
      } = { step, complete: complete && step >= 3 };
      if (step === 1) {
        patch.opportunityKinds = formData.getAll("kinds").map(String);
        patch.sectors = formData.getAll("sectors").map(String);
        patch.roleFamilySlugs = formData.getAll("roles").map(String);
        patch.otherRoleNote = String(formData.get("other") ?? "");
      }
      if (step === 2) {
        patch.workModes = formData.getAll("modes").map(String);
        patch.locationLabel = String(formData.get("location") ?? "");
        patch.countryCode = String(formData.get("country") ?? "IN");
        patch.experienceBand = String(formData.get("experience") ?? "");
        patch.stage = String(formData.get("stage") ?? "");
      }
      if (step === 3) {
        patch.skillSlugs = String(formData.get("skills") ?? "").split(",").map((item) => item.trim()).filter(Boolean);
        patch.showUnknownPay = formData.get("unknownPay") === "yes";
      }
      store.savePreferences(actor, patch);
    });
  } catch (error) {
    fail(error);
  }
  redirect(complete || step >= 3 ? "/feed" : `/onboarding?step=${step + 1}`);
}

export async function toggleSave(formData: FormData) {
  const jobId = String(formData.get("jobId") ?? "");
  const saved = formData.get("saved") === "yes";
  await withStore(async (store) => {
    const actor = await readActor(store);
    store.setSaved(actor, jobId, saved);
  });
  redirect(safeReturnPath(String(formData.get("next") ?? "/saved")));
}

export async function openAndReturn(formData: FormData) {
  const jobId = String(formData.get("jobId") ?? "");
  const result = await withStore(async (store) => {
    const actor = await readActor(store);
    return store.openApplication(actor, jobId);
  });
  if (result.url) redirect(result.url);
  redirect(`/jobs/${jobId}?mailto=1`);
}

export async function markApplied(formData: FormData) {
  const jobId = String(formData.get("jobId") ?? "");
  const applied = formData.get("applied") !== "no";
  await withStore(async (store) => {
    const actor = await readActor(store);
    store.markApplied(actor, jobId, applied);
  });
  redirect(`/jobs/${jobId}`);
}

export async function reportListing(formData: FormData) {
  const jobId = String(formData.get("jobId") ?? "");
  await withStore(async (store) => {
    const actor = await readActor(store);
    store.reportJob(actor, jobId, String(formData.get("reason") ?? "other"), String(formData.get("detail") ?? ""));
  });
  redirect(`/jobs/${jobId}?reported=1`);
}

export async function acceptTerms() {
  await withStore(async (store) => {
    const actor = await readActor(store);
    store.acceptReferralTerms(actor);
  });
  redirect("/referrals");
}

export async function requestPayout(formData: FormData) {
  const amount = Math.round(Number(formData.get("amount") ?? 0) * 100);
  try {
    await withStore(async (store) => {
      const actor = await readActor(store);
      store.requestPayout(actor, { amountMinor: amount, beneficiaryMasked: String(formData.get("beneficiary") ?? "") });
    });
  } catch (error) {
    redirect(`/referrals?error=${encodeURIComponent(error instanceof AppError ? error.message : "Could not request a payout.")}`);
  }
  redirect("/referrals");
}

export async function saveSourceAction(formData: FormData) {
  await withStore(async (store) => {
    const actor = await readActor(store);
    store.saveSource(actor, {
      name: String(formData.get("name") ?? ""),
      type: String(formData.get("type") ?? "employer"),
      canonicalDomain: String(formData.get("domain") ?? ""),
      permissionBasis: String(formData.get("permission") ?? ""),
      enabled: formData.get("enabled") === "yes",
      boardId: String(formData.get("boardId") ?? ""),
    });
  });
  redirect("/admin/sources");
}

export async function saveJobAction(formData: FormData) {
  const job = jobFromForm(formData);
  const saved = await withStore(async (store) => {
    const actor = await readActor(store);
    return store.saveJob(actor, job);
  });
  if (formData.get("publish") === "yes") {
    await withStore(async (store) => {
      const actor = await readActor(store);
      store.publishJob(actor, saved.jobId);
    });
  }
  redirect("/admin/jobs");
}

export async function publishJobAction(formData: FormData) {
  const jobId = String(formData.get("jobId") ?? "");
  try {
    await withStore(async (store) => {
      const actor = await readActor(store);
      store.publishJob(actor, jobId);
    });
  } catch (error) {
    redirect(`/admin/review?error=${encodeURIComponent(error instanceof AppError ? error.message : "Could not publish.")}`);
  }
  redirect("/admin/jobs");
}

export async function archiveJobAction(formData: FormData) {
  await withStore(async (store) => {
    const actor = await readActor(store);
    store.archiveJob(actor, String(formData.get("jobId") ?? ""), String(formData.get("reason") ?? ""));
  });
  redirect("/admin/jobs");
}

export async function createCredentialAction(formData: FormData) {
  const created = await withStore(async (store) => {
    const actor = await readActor(store);
    return store.createCredential(actor, {
      name: String(formData.get("name") ?? "Collector"),
      sourceIds: formData.getAll("sourceIds").map(String),
      scopes: formData.getAll("scopes").map(String),
    });
  });
  redirect(`/admin/sources?token=${encodeURIComponent(created.token)}`);
}

export async function settlePayoutAction(formData: FormData) {
  await withStore(async (store) => {
    const actor = await readActor(store);
    const status = String(formData.get("status") ?? "under_review") as "paid" | "failed" | "rejected" | "under_review" | "approved" | "processing" | "unknown" | "reversed" | "requested";
    store.settlePayout(actor, {
      payoutId: String(formData.get("payoutId") ?? ""),
      status,
      evidence: formData.get("reference")
        ? {
            reference: String(formData.get("reference")),
            amountMinor: Math.round(Number(formData.get("amount") ?? 0) * 100),
            settledAt: new Date().toISOString(),
          }
        : undefined,
    });
  });
  redirect("/admin/payouts");
}

export async function saveCampaignAction(formData: FormData) {
  await withStore(async (store) => {
    const actor = await readActor(store);
    store.saveCampaign(actor, {
      name: String(formData.get("name") ?? ""),
      destinationUrl: String(formData.get("url") ?? ""),
      startsAt: new Date(String(formData.get("starts") ?? "")).toISOString(),
      endsAt: new Date(String(formData.get("ends") ?? "")).toISOString(),
      active: formData.get("active") === "yes",
    });
    if (formData.get("active") === "yes") store.setFlag(actor, "ads_enabled", true);
  });
  redirect("/admin/ads");
}

function jobFromForm(formData: FormData): JobInput {
  const min = formData.get("payMin");
  const max = formData.get("payMax");
  const compensationType = String(formData.get("compensationType") ?? "not_disclosed");
  const unpaid = compensationType === "unpaid";
  const disclosed = compensationType !== "not_disclosed" && compensationType !== "unpaid";
    return {
      title: String(formData.get("title") ?? ""),
      companyName: String(formData.get("company") ?? ""),
      summary: String(formData.get("summary") ?? ""),
      opportunityKind: String(formData.get("kind") ?? "job"),
      sector: String(formData.get("sector") ?? "private"),
      workMode: String(formData.get("mode") ?? "not_stated"),
      roleFamilySlug: String(formData.get("role") ?? "") || null,
      locationLabel: String(formData.get("location") ?? ""),
      locationUnknown: formData.get("locationUnknown") === "yes",
      countryCode: "IN",
      eligibleCountries: String(formData.get("countries") ?? "IN").split(",").map((item) => item.trim()).filter(Boolean),
      skills: String(formData.get("skills") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      requirements: String(formData.get("requirements") ?? "").split("\n").map((item) => item.trim()).filter(Boolean),
      compensationType,
      payMinMinor: unpaid ? 0 : disclosed && min !== "" ? Math.round(Number(min) * 100) : null,
      payMaxMinor: unpaid ? 0 : disclosed && max !== "" ? Math.round(Number(max) * 100) : null,
      payCurrency: disclosed || unpaid ? "INR" : null,
      payPeriod: disclosed || unpaid ? String(formData.get("period") ?? "annual") : null,
      payBasis: disclosed || unpaid ? String(formData.get("basis") ?? "not_stated") : null,
    applicationMethod: String(formData.get("applicationMethod") ?? "url") as JobInput["applicationMethod"],
    applicationUrl: String(formData.get("applicationUrl") ?? "") || null,
    hrEmail: String(formData.get("hrEmail") ?? "") || null,
    emailSubject: String(formData.get("emailSubject") ?? "") || null,
    hrEmailApproved: formData.get("hrApproved") === "yes",
    sourceId: String(formData.get("sourceId") ?? ""),
    sourceUrl: String(formData.get("sourceUrl") ?? ""),
    externalJobId: String(formData.get("externalJobId") ?? "") || null,
    sourcePublishedAt: String(formData.get("sourcePublishedAt") ?? "") || null,
    deadlineAt: String(formData.get("deadline") ?? "") || null,
    accessTier: String(formData.get("tier") ?? "free") === "pro" ? "pro" : "free",
    evidenceExcerpt: String(formData.get("evidence") ?? ""),
    government: formData.get("notice")
      ? { noticeNumber: String(formData.get("notice")) }
      : null,
  };
}
