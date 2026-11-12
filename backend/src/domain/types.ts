export type AccessTier = "free" | "pro";

export type JobRecord = {
  jobId: string;
  version: number;
  title: string;
  companyName: string;
  companyId: string;
  summary: string;
  opportunityKind: string;
  employmentArrangement: string;
  sector: string;
  workMode: string;
  seniority: string;
  roleFamilySlug: string | null;
  industrySlug: string | null;
  locationLabel: string;
  locationUnknown: boolean;
  countryCode: string | null;
  eligibleCountries: string[];
  skills: string[];
  requirements: string[];
  eligibility: string[];
  responsibilities: string[];
  batchLabel: string | null;
  durationLabel: string | null;
  originalSourceLabel: string | null;
  payDisplayLabel: string | null;
  applyNote: string | null;
  compensationType: string;
  payMinMinor: number | null;
  payMaxMinor: number | null;
  payCurrency: string | null;
  payPeriod: string | null;
  payBasis: string | null;
  applicationMethod: "url" | "email" | "both";
  applicationUrl: string | null;
  hrEmail: string | null;
  emailSubject: string | null;
  hrEmailApproved: boolean;
  sourceId: string;
  sourceUrl: string;
  externalJobId: string | null;
  sourcePublishedAt: string | null;
  datePrecision: "instant" | "date";
  firstSeenAt: string;
  effectiveJobAt: string;
  visibleUntil: string;
  publishedAt: string | null;
  lastCheckedAt: string | null;
  deadlineAt: string | null;
  accessTier: AccessTier;
  verification: string;
  lifecycle: "draft" | "in_review" | "published" | "archived" | "removed" | "closed";
  government: Record<string, string> | null;
  evidence: { sourceUrl: string; fetchedAt: string; excerpt: string }[];
  archiveReason?: string;
  archivedAt?: string;
};

export type Preferences = {
  userId: string;
  opportunityKinds: string[];
  sectors: string[];
  roleFamilySlugs: string[];
  skillSlugs: string[];
  workModes: string[];
  locationLabel: string;
  countryCode: string;
  experienceBand: string;
  stage: string;
  showUnknownPay: boolean;
  jobPayTargetMinor: number | null;
  internshipPayTargetMinor: number | null;
  otherRoleNote: string;
  updatedAt: string;
};

export type UserAccount = {
  userId: string;
  email: string;
  displayName: string;
  countryCode: string;
  currentStage: string;
  onboardingStep: number;
  onboardingCompleted: boolean;
  adultConfirmed: boolean;
  roles: string[];
  suspended: boolean;
  createdAt: string;
  deletedAt: string | null;
};

export type Actor =
  | { kind: "anonymous" }
  | { kind: "user"; userId: string; email: string; roles: string[]; suspended: boolean }
  | { kind: "agent"; credentialId: string; scopes: string[]; sourceIds: string[] }
  | { kind: "system" };

/** Signed-in members can read all published listings (Pro paywall removed for now). */
export function canReadTier(actor: Actor, _tier: AccessTier, _now: Date, _preview: "free" | "pro" | null): boolean {
  if (actor.kind === "anonymous" || actor.kind === "agent") return false;
  if (actor.kind === "system") return true;
  return !actor.suspended;
}
