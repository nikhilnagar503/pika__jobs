import type { MemoryStore } from "@/repositories/memory";

/** Bump this to replace old demo inventory with the alert-format showcase listings. */
export const DEMO_SEED_VERSION = "alert-format-v1";

/** Publish showcase listings once (and again when DEMO_SEED_VERSION changes). */
export function seedDemoListings(store: MemoryStore, now = new Date()) {
  if (store.db.demoSeedVersion === DEMO_SEED_VERSION) return;

  // Drop previous demo inventory so the feed matches the alert screenshots.
  const isDemo = (job: { externalJobId: string | null; evidence?: { excerpt: string }[] }) =>
    Boolean(job.externalJobId?.startsWith("demo-")) ||
    (job.evidence ?? []).some((item) => item.excerpt.includes("Demo listing"));
  store.db.jobsCurrent = store.db.jobsCurrent.filter((job) => !isDemo(job));
  store.db.jobsArchive = store.db.jobsArchive.filter((job) => !isDemo(job));
  store.db.drafts = store.db.drafts.filter((job) => !isDemo(job));

  const actor = { kind: "system" as const };
  store.ensureAuthUser({
    userId: "00000000-0000-4000-8000-000000000001",
    email: "seed@pikajobs.local",
    displayName: "Demo seeder",
    adultConfirmed: true,
    roles: ["admin"],
    now,
  });
  const admin = store.actorFor("00000000-0000-4000-8000-000000000001", now);
  let source = store.db.sources.find((item) => item.boardId === "demo");
  if (!source) {
    source = store.saveSource(
      admin,
      {
        name: "Demo employer boards",
        type: "employer",
        canonicalDomain: "careers.example.com",
        permissionBasis: "Demo fixtures for product review. Not live openings.",
        enabled: true,
        boardId: "demo",
      },
      now,
    );
  }

  const demos = [
    {
      title: "Product Manager Intern",
      companyName: "BusinessOnBot",
      summary: "Work on the AI Agents module with the product team in Bengaluru.",
      opportunityKind: "internship",
      workMode: "hybrid",
      roleFamilySlug: "product",
      locationLabel: "Bengaluru",
      batchLabel: "2025/2026/2027",
      durationLabel: "6 months",
      skills: ["Product", "AI", "LLMs"],
      eligibility: ["Final-year students or recent graduates."],
      requirements: [
        "Curiosity about AI/LLMs and how they can solve real problems.",
        "Experience building something with AI (even personal projects).",
        "Strong problem-solving and communication skills.",
        "Interest in product management and willingness to learn fast.",
      ],
      responsibilities: [
        "Work on the AI Agents module — a core part of the platform.",
        "Collaborate with the Product Lead and cross-functional teams.",
        "Interact with customers and turn feedback into product insights.",
        "Take ideas from concept to launch.",
      ],
      compensationType: "stipend",
      payMinMinor: 3000000,
      payMaxMinor: 3000000,
      payPeriod: "monthly" as const,
      payDisplayLabel: "₹30,000/month",
      applicationMethod: "email" as const,
      applicationUrl: null as string | null,
      hrEmail: "gouthamip@businessonbot.com",
      emailSubject: "PM Intern Application",
      hrEmailApproved: true,
      applyNote: "Send your resume and a short note on why you want to join to",
      sourceUrl: "https://careers.example.com/demo/businessonbot-pm-intern",
      externalJobId: "demo-bob-pm-intern",
    },
    {
      title: "Forward Deployed Engineer",
      companyName: "Firstsource",
      summary: "Forward deployed engineering role for strong coders from preferred institutes.",
      opportunityKind: "job",
      workMode: "on_site",
      roleFamilySlug: "software-it",
      locationLabel: "Hyderabad",
      batchLabel: "2024/2025/2026",
      durationLabel: null as string | null,
      skills: ["Coding", "Problem solving"],
      eligibility: [] as string[],
      requirements: [
        "Preferred institutes: IITs and NITs.",
        "Eligible branches: CSE/CSC, IT, AI/ML and ECE.",
        "Strong coding and problem-solving skills.",
      ],
      responsibilities: [] as string[],
      compensationType: "salary",
      payMinMinor: 120000000,
      payMaxMinor: 180000000,
      payPeriod: "annual" as const,
      payDisplayLabel: "₹12–18 LPA",
      applicationMethod: "url" as const,
      applicationUrl: "https://docs.google.com/forms/d/e/1FAIpQLSdDemoFirstsourceFDE/viewform",
      hrEmail: null as string | null,
      emailSubject: null as string | null,
      hrEmailApproved: false,
      applyNote: null as string | null,
      originalSourceLabel: "SDE Jobs and Internships",
      sourceUrl: "https://careers.example.com/demo/firstsource-fde",
      externalJobId: "demo-firstsource-fde",
    },
    {
      title: "Frontend engineering intern",
      companyName: "Example Studio",
      summary: "Ship UI fixes and small features with the product engineering team.",
      opportunityKind: "internship",
      workMode: "hybrid",
      roleFamilySlug: "software-it",
      locationLabel: "Bengaluru",
      batchLabel: "2025/2026",
      durationLabel: "3 months",
      skills: ["React", "TypeScript"],
      eligibility: ["Final-year CS/IT students or recent graduates."],
      requirements: [
        "Comfortable with React fundamentals and basic TypeScript.",
        "Can share a small portfolio or GitHub sample.",
      ],
      responsibilities: ["Ship UI fixes and small features with mentoring from senior engineers."],
      compensationType: "stipend",
      payMinMinor: 2500000,
      payMaxMinor: 2500000,
      payPeriod: "monthly" as const,
      payDisplayLabel: "₹25,000/month",
      applicationMethod: "url" as const,
      applicationUrl: "https://careers.example.com/interns/frontend",
      hrEmail: null as string | null,
      emailSubject: null as string | null,
      hrEmailApproved: false,
      applyNote: null as string | null,
      sourceUrl: "https://careers.example.com/interns/frontend",
      externalJobId: "demo-fe-intern",
    },
    {
      title: "Junior software engineer",
      companyName: "Cedar Systems",
      summary: "Work on API endpoints and bug fixes with senior engineers mentoring the work.",
      opportunityKind: "job",
      workMode: "hybrid",
      roleFamilySlug: "software-it",
      locationLabel: "Chennai",
      batchLabel: "2024/2025/2026",
      durationLabel: null as string | null,
      skills: ["JavaScript", "Node.js"],
      eligibility: [] as string[],
      requirements: [
        "Eligible branches: CSE/IT or related.",
        "Strong coding and problem-solving skills.",
        "Familiar with Git and at least one backend or frontend stack.",
      ],
      responsibilities: [] as string[],
      compensationType: "salary",
      payMinMinor: 50000000,
      payMaxMinor: 70000000,
      payPeriod: "annual" as const,
      payDisplayLabel: "₹5–7 LPA",
      applicationMethod: "both" as const,
      applicationUrl: "https://careers.example.com/jobs/junior-swe",
      hrEmail: "careers@cedarsystems.example.com",
      emailSubject: "Junior SWE Application",
      hrEmailApproved: true,
      applyNote: "Or email your resume to",
      sourceUrl: "https://careers.example.com/jobs/junior-swe",
      externalJobId: "demo-junior-swe",
    },
  ];

  for (const demo of demos) {
    const draft = store.saveJob(
      actor,
      {
        title: demo.title,
        companyName: demo.companyName,
        summary: demo.summary,
        opportunityKind: demo.opportunityKind,
        sector: "private",
        workMode: demo.workMode,
        roleFamilySlug: demo.roleFamilySlug,
        locationLabel: demo.locationLabel,
        countryCode: "IN",
        eligibleCountries: ["IN"],
        skills: [...demo.skills],
        requirements: [...demo.requirements],
        eligibility: [...demo.eligibility],
        responsibilities: [...demo.responsibilities],
        batchLabel: demo.batchLabel,
        durationLabel: demo.durationLabel,
        originalSourceLabel: "originalSourceLabel" in demo ? demo.originalSourceLabel ?? null : null,
        payDisplayLabel: demo.payDisplayLabel,
        applyNote: demo.applyNote,
        compensationType: demo.compensationType,
        payMinMinor: demo.payMinMinor,
        payMaxMinor: demo.payMaxMinor,
        payCurrency: "INR",
        payPeriod: demo.payPeriod,
        payBasis: demo.compensationType === "salary" ? "ctc" : "stipend",
        applicationMethod: demo.applicationMethod,
        applicationUrl: demo.applicationUrl,
        hrEmail: demo.hrEmail,
        emailSubject: demo.emailSubject,
        hrEmailApproved: demo.hrEmailApproved,
        sourceId: source.id,
        sourceUrl: demo.sourceUrl,
        externalJobId: demo.externalJobId,
        sourcePublishedAt: now.toISOString(),
        accessTier: "free",
        evidenceExcerpt: "Demo listing for product review. Not a live opening.",
      },
      now,
    );
    store.publishJob(actor, draft.jobId, now);
  }

  store.db.demoSeedVersion = DEMO_SEED_VERSION;
}
