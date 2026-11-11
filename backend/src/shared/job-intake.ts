import { z } from "zod";

export const opportunityKindSchema = z.enum([
  "job",
  "internship",
  "apprenticeship",
  "freelance",
  "fellowship",
]);

export const workModeSchema = z.enum(["remote", "hybrid", "on_site", "field", "not_stated"]);

export const intakeRecordSchema = z
  .object({
    schema_version: z.literal("1.0"),
    client_reference: z.string().trim().min(1).max(120),
    source_id: z.string().uuid(),
    source_url: z.string().trim().min(1).max(2000),
    source_job_id: z.string().trim().min(1).max(200).nullable().optional(),
    company_name: z.string().trim().min(1).max(160),
    role_title: z.string().trim().min(1).max(180),
    opportunity_kind: opportunityKindSchema,
    work_mode: workModeSchema,
    location_label: z.string().trim().max(180).optional(),
    location_unknown: z.boolean().optional(),
    summary: z.string().trim().min(1).max(400),
    application: z.object({
      method: z.enum(["url", "email", "both"]),
      url: z.string().trim().max(2000).optional(),
      email: z.string().trim().max(200).optional(),
      subject: z.string().trim().max(180).optional(),
    }),
    evidence: z
      .array(
        z.object({
          source_url: z.string().trim().min(1).max(2000),
          fetched_at: z.string().datetime(),
          excerpt: z.string().trim().min(1).max(500),
        }),
      )
      .min(1)
      .max(8),
    collected_at: z.string().datetime(),
    source_published_at: z.string().datetime().nullable().optional(),
    eligible_countries: z.array(z.string().trim().min(2).max(80)).max(20).optional(),
    skills: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
    role_family: z.string().trim().max(80).optional(),
    sector: z.string().trim().max(40).optional(),
  })
  .superRefine((record, context) => {
    if (!record.location_unknown && !record.location_label?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["location_label"],
        message: "Provide a location label or mark location unknown.",
      });
    }
    if ((record.application.method === "url" || record.application.method === "both") && !record.application.url) {
      context.addIssue({ code: "custom", path: ["application", "url"], message: "An application URL is required." });
    }
    if ((record.application.method === "email" || record.application.method === "both") && !record.application.email) {
      context.addIssue({ code: "custom", path: ["application", "email"], message: "An HR email is required." });
    }
  });

export const intakeBatchSchema = z.object({
  schema_version: z.literal("1.0"),
  records: z.array(z.unknown()).min(1).max(100),
});

export type IntakeRecord = z.infer<typeof intakeRecordSchema>;
