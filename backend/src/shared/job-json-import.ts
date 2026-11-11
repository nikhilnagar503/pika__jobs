import type { JobInput } from "@/repositories/memory";

export type ImportJobDraft = Omit<JobInput, "sourceId"> & {
  importKey: string;
  skipped?: boolean;
  skipReason?: string;
};

export type ImportParseResult = {
  format: "pikajobs" | "catalog" | "tracker" | "unknown";
  category: string | null;
  generatedDate: string | null;
  drafts: ImportJobDraft[];
  skipped: Array<{ key: string; reason: string }>;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanAlertNoise(value: string): string {
  return value
    .replace(/🚨\s*Opportunity Alert\s*🚨/gi, "")
    .replace(/Opportunity Alert/gi, "")
    .replace(/🚨/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = asString(value);
    if (text) return text;
  }
  return "";
}

function mapWorkMode(raw: string): string {
  const value = raw.toLowerCase().replace(/[-\s]+/g, "_");
  if (value.includes("remote") || value === "wfh") return "remote";
  if (value.includes("hybrid")) return "hybrid";
  if (value.includes("field")) return "field";
  if (
    value.includes("on_site") ||
    value.includes("onsite") ||
    value.includes("in_office") ||
    value.includes("office") ||
    value.includes("in-office")
  ) {
    return "on_site";
  }
  return "not_stated";
}

function mapOpportunityKind(raw: string): string {
  const value = raw.toLowerCase().replace(/[-\s]+/g, "_");
  if (value.includes("intern")) return "internship";
  if (value.includes("apprentice")) return "apprenticeship";
  if (value.includes("freelance") || value.includes("contract") || value.includes("gig")) return "freelance";
  if (value.includes("fellow")) return "fellowship";
  return "job";
}

function mapSector(raw: string): string {
  const value = raw.toLowerCase();
  if (value.includes("gov") || value.includes("public") || value.includes("psu")) return "government";
  return "private";
}

function mapCompensationType(raw: string, opportunityKind: string): string {
  const value = raw.toLowerCase();
  if (value.includes("unpaid") || value.includes("volunteer")) return "unpaid";
  if (value.includes("stipend")) return "stipend";
  if (value.includes("salary") || value.includes("ctc") || value.includes("lpa") || value.includes("package")) {
    return "salary";
  }
  if (opportunityKind === "internship" || opportunityKind === "apprenticeship" || opportunityKind === "fellowship") {
    return "stipend";
  }
  if (!value) return "not_disclosed";
  return "not_disclosed";
}

function mapRoleFamily(raw: string): string | null {
  const value = raw.toLowerCase();
  if (!value) return null;
  if (value.includes("ml") || value.includes("ai") || value.includes("data")) return "data-ai";
  if (value.includes("product")) return "product";
  if (value.includes("design") || value.includes("ui") || value.includes("ux")) return "design";
  if (value.includes("market") || value.includes("growth") || value.includes("sales")) return "business";
  if (
    value.includes("frontend") ||
    value.includes("backend") ||
    value.includes("full") ||
    value.includes("swe") ||
    value.includes("sde") ||
    value.includes("software") ||
    value.includes("engineer") ||
    value.includes("developer")
  ) {
    return "software-it";
  }
  return "software-it";
}

function mapPayPeriod(raw: string, payLabel: string): string {
  const value = `${raw} ${payLabel}`.toLowerCase();
  if (value.includes("year") || value.includes("lpa") || value.includes("ctc") || value.includes("annum")) {
    return "yearly";
  }
  if (value.includes("week")) return "weekly";
  if (value.includes("hour")) return "hourly";
  return "monthly";
}

function extractMailto(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith("mailto:")) return null;
  const email = trimmed.slice("mailto:".length).split("?")[0]?.trim();
  return email || null;
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseApply(raw: Record<string, unknown>, title: string): {
  applicationMethod: "url" | "email" | "both";
  applicationUrl: string | null;
  hrEmail: string | null;
  hrEmailApproved: boolean;
  sourceUrl: string;
  emailSubject: string;
  applyNote: string | null;
  hasContactRoute: boolean;
} {
  const applyObject = raw.apply && typeof raw.apply === "object" && !Array.isArray(raw.apply)
    ? (raw.apply as Record<string, unknown>)
    : null;

  const url = firstString(
    applyObject?.url,
    applyObject?.link,
    raw.direct_application_url,
    raw.apply_link,
    raw.application_url,
    raw.apply_url,
    raw.url,
  );
  const emailRaw = firstString(
    applyObject?.email,
    applyObject?.hr_email,
    raw.hr_email,
    raw.email,
    raw.apply_email,
  );
  const phone = firstString(applyObject?.phone, raw.phone, raw.contact_phone, raw.mobile);
  const contactName = firstString(applyObject?.contact_name, raw.contact_name, raw.recruiter);
  const walkIn =
    raw.walk_in && typeof raw.walk_in === "object" && !Array.isArray(raw.walk_in)
      ? (raw.walk_in as Record<string, unknown>)
      : null;
  const walkInBits = [
    firstString(walkIn?.venue) ? `Venue: ${firstString(walkIn?.venue)}` : "",
    firstString(walkIn?.date) ? `Date: ${firstString(walkIn?.date)}` : "",
    firstString(walkIn?.time) ? `Time: ${firstString(walkIn?.time)}` : "",
  ].filter(Boolean);
  const noteParts = [
    firstString(applyObject?.note, raw.apply_note, raw.application_note),
    contactName ? `Contact: ${contactName}` : "",
    phone ? `Phone: ${phone}` : "",
    ...walkInBits,
  ].filter(Boolean);
  const note = noteParts.length ? noteParts.join(" · ") : null;
  const subject =
    firstString(applyObject?.subject, raw.email_subject, raw.apply_subject) || `${title} application`;

  let applicationUrl: string | null = null;
  let hrEmail: string | null = null;

  const mailto = extractMailto(url);
  if (mailto) hrEmail = mailto;
  else if (/^https?:\/\//i.test(url)) applicationUrl = url;
  else if (looksLikeEmail(url)) hrEmail = url;

  if (emailRaw) {
    const fromMailto = extractMailto(emailRaw);
    hrEmail = fromMailto || (looksLikeEmail(emailRaw) ? emailRaw : hrEmail);
  }

  const hasContactRoute = Boolean(applicationUrl || hrEmail || phone || walkInBits.length);

  if (applicationUrl && hrEmail) {
    return {
      applicationMethod: "both",
      applicationUrl,
      hrEmail,
      hrEmailApproved: true,
      sourceUrl: applicationUrl,
      emailSubject: subject,
      applyNote: note,
      hasContactRoute,
    };
  }

  if (hrEmail) {
    return {
      applicationMethod: "email",
      applicationUrl: null,
      hrEmail,
      hrEmailApproved: true,
      sourceUrl: "https://pikajobs.com",
      emailSubject: subject,
      applyNote: note,
      hasContactRoute,
    };
  }

  return {
    applicationMethod: "url",
    applicationUrl,
    hrEmail: null,
    hrEmailApproved: false,
    sourceUrl: applicationUrl || "https://pikajobs.com",
    emailSubject: subject,
    applyNote: note,
    hasContactRoute,
  };
}

function durationFromText(...values: string[]): string | null {
  for (const value of values) {
    if (!value) continue;
    const match = value.match(/(\d+\s*-\s*\d+\s*months?|\d+\s*months?|\d+\s*weeks?)/i);
    if (match) return match[1].replace(/\s+/g, " ");
  }
  return null;
}

function parsePostedAt(...values: string[]): string | null {
  for (const postedRaw of values) {
    if (!postedRaw) continue;
    const parsed = new Date(postedRaw.replace(" IST", "").replace(" ", "T"));
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function draftFromCatalogJob(raw: Record<string, unknown>, index: number): ImportJobDraft | { skipped: true; key: string; reason: string } {
  const title = cleanAlertNoise(
    firstString(raw.title, raw.job_title, raw.role, raw.position, raw.designation),
  );
  const company = cleanAlertNoise(
    firstString(raw.company, raw.company_name, raw.organization, raw.org),
  );
  const key = firstString(raw.id, raw.external_id, raw.job_id) || `${company}-${title}-${index}`;

  if (!title || !company) {
    return { skipped: true, key, reason: "Missing job title or company." };
  }

  const apply = parseApply(raw, title);
  if (!apply.hasContactRoute) {
    return { skipped: true, key, reason: "Missing application link, email, phone, or walk-in details." };
  }

  const opportunityKind = mapOpportunityKind(
    firstString(raw.type, raw.opportunity_kind, raw.job_type, raw.role_type, raw.employment_type, title),
  );
  const location = firstString(raw.location, raw.location_label, raw.city);
  const batches = asStringArray(raw.batches).length
    ? asStringArray(raw.batches)
    : asStringArray(raw.eligible_batches);
  const skills = asStringArray(raw.skills).length
    ? asStringArray(raw.skills)
    : asStringArray(raw.key_skills);
  const eligibility = asStringArray(raw.eligibility);
  const requirements = asStringArray(raw.requirements);
  const responsibilities = asStringArray(raw.responsibilities);

  const payObject = raw.pay && typeof raw.pay === "object" && !Array.isArray(raw.pay)
    ? (raw.pay as Record<string, unknown>)
    : null;
  const compensation = firstString(
    payObject?.label,
    payObject?.display,
    raw.compensation,
    raw.stipend,
    raw.salary,
    raw.ctc,
    raw.pay_label,
  );
  const compensationType = mapCompensationType(
    firstString(payObject?.type, raw.compensation_type, compensation),
    opportunityKind,
  );
  const payCurrency = firstString(payObject?.currency, raw.pay_currency, raw.currency) || "INR";
  const payPeriod = mapPayPeriod(firstString(payObject?.period, raw.pay_period), compensation);

  const experience = firstString(raw.experience, raw.experience_level, raw.seniority);
  const institutions = firstString(raw.institutions, raw.target_institutions, raw.colleges);
  const durationLabel =
    firstString(raw.duration, raw.duration_label) ||
    durationFromText(firstString(raw.type, raw.job_type, raw.role_type));
  const summary = cleanAlertNoise(
    firstString(raw.summary, raw.description) ||
      [
        experience ? `Level: ${experience}.` : "",
        institutions ? `Target: ${institutions}.` : "",
        compensation ? `Pay: ${compensation}.` : "",
        location ? `Location: ${location}.` : "",
      ]
        .filter(Boolean)
        .join(" ") ||
      `${title} at ${company}`,
  ).slice(0, 400);

  const sourcePublishedAt = parsePostedAt(
    firstString(raw.posted_at, raw.posted_date, raw.posted_or_seen_time, raw.date),
  );
  const deadlineAt = parsePostedAt(firstString(raw.deadline_at, raw.deadline, raw.apply_by));

  const openings = firstString(raw.openings, raw.number_of_openings);
  const minCgpa = firstString(raw.min_cgpa, raw.cgpa, raw.cgpa_cutoff);
  const joining = firstString(raw.joining_date, raw.joining, raw.start_date);
  const bond = firstString(raw.bond);
  const ppo = firstString(raw.ppo);
  const employment = firstString(raw.employment, raw.employment_type);
  const relocation = firstString(raw.relocation);
  const companyWebsite = firstString(raw.company_website, raw.website);
  const tags = asStringArray(raw.tags);
  const interviewRounds = asStringArray(raw.interview_rounds);

  const builtEligibility = [
    ...eligibility,
    ...(batches.length ? [`Eligible batches: ${batches.join("/")}`] : []),
    ...(institutions ? [institutions] : []),
    ...(experience ? [experience] : []),
    ...(minCgpa ? [`Min CGPA: ${minCgpa}`] : []),
    ...(openings ? [`Openings: ${openings}`] : []),
    ...(joining ? [`Joining: ${joining}`] : []),
    ...(bond ? [`Bond: ${bond}`] : []),
    ...(ppo ? [`PPO: ${ppo}`] : []),
    ...(employment ? [`Employment: ${employment}`] : []),
    ...(relocation ? [`Relocation: ${relocation}`] : []),
    ...(interviewRounds.length ? [`Interview: ${interviewRounds.join(" → ")}`] : []),
    ...(tags.length ? [`Tags: ${tags.join(", ")}`] : []),
    ...(companyWebsite ? [`Company site: ${companyWebsite}`] : []),
  ]
    .map((item) => cleanAlertNoise(item))
    .filter(Boolean)
    .slice(0, 8);

  const builtRequirements = (requirements.length ? requirements : skills.map((skill) => `Skill: ${skill}`))
    .map((item) => cleanAlertNoise(item))
    .filter(Boolean)
    .slice(0, 8);

  return {
    importKey: key,
    title,
    companyName: company,
    summary,
    opportunityKind,
    sector: mapSector(firstString(raw.sector, raw.category_sector)),
    workMode: mapWorkMode(
      firstString(raw.work_mode, raw.work_arrangement, raw.mode, location),
    ),
    roleFamilySlug: mapRoleFamily(
      firstString(raw.role_family, raw.role_type, raw.domain, title),
    ),
    locationLabel: location || "India",
    locationUnknown: !location,
    countryCode: firstString(raw.country, raw.country_code) || "IN",
    skills: skills.slice(0, 8),
    eligibility: builtEligibility,
    requirements: builtRequirements,
    responsibilities: responsibilities.map((item) => cleanAlertNoise(item)).filter(Boolean).slice(0, 8),
    batchLabel: batches.length ? batches.join("/") : firstString(raw.batch_label) || null,
    durationLabel,
    originalSourceLabel:
      firstString(raw.source, raw.original_source, raw.category) || "JSON import",
    payDisplayLabel: compensation || null,
    applyNote: apply.applyNote,
    compensationType,
    payCurrency,
    payPeriod,
    applicationMethod: apply.applicationMethod,
    applicationUrl: apply.applicationUrl,
    hrEmail: apply.hrEmail,
    hrEmailApproved: apply.hrEmailApproved,
    emailSubject: apply.emailSubject,
    sourceUrl: firstString(raw.source_url, apply.sourceUrl) || apply.sourceUrl,
    externalJobId: key.slice(0, 120),
    sourcePublishedAt,
    deadlineAt,
    accessTier: firstString(raw.access, raw.access_tier).toLowerCase() === "pro" ? "pro" : "free",
    evidenceExcerpt: `${title} at ${company}. Imported from admin JSON upload.`,
  };
}

function collectTrackerJobs(payload: Record<string, unknown>): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const key of ["jobs", "telegram_jobs", "scraped_jobs", "listings"]) {
    const value = payload[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object") rows.push(item as Record<string, unknown>);
      }
    }
  }
  return rows;
}

export function parseJobImportJson(payload: unknown): ImportParseResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("JSON root must be an object with a jobs array.");
  }
  const root = payload as Record<string, unknown>;
  const rows = collectTrackerJobs(root);
  if (!rows.length) {
    throw new Error("No jobs found. Expected keys like jobs, telegram_jobs, or scraped_jobs.");
  }

  const hasPikajobsFields = rows.some(
    (row) => "apply" in row || "pay" in row || ("title" in row && "type" in row),
  );
  const hasCatalogFields = rows.some((row) => "job_title" in row || "direct_application_url" in row);
  const hasTrackerFields = rows.some((row) => "role" in row || "apply_link" in row);
  const format = hasPikajobsFields
    ? "pikajobs"
    : hasCatalogFields
      ? "catalog"
      : hasTrackerFields
        ? "tracker"
        : "unknown";

  const drafts: ImportJobDraft[] = [];
  const skipped: Array<{ key: string; reason: string }> = [];

  rows.forEach((row, index) => {
    const mapped = draftFromCatalogJob(row, index);
    if ("skipped" in mapped && mapped.skipped) {
      skipped.push({ key: mapped.key, reason: mapped.reason });
      return;
    }
    drafts.push(mapped as ImportJobDraft);
  });

  return {
    format,
    category: asString(root.category) || null,
    generatedDate: asString(root.generated_date) || asString(root.date) || null,
    drafts,
    skipped,
  };
}
