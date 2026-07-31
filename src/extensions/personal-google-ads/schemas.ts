import { z } from "zod";

const keywordSchema = z.string().trim().min(1).max(80);

const httpsUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => new URL(value).protocol === "https:", {
    message: "URL must use HTTPS",
  });

export const plannerStatusInputSchema = z.object({
  projectId: z.string().min(1),
});

export const generateKeywordIdeasInputSchema = z
  .object({
    projectId: z.string().min(1),
    keywords: z.array(keywordSchema).max(10).default([]),
    url: httpsUrlSchema.optional(),
    locationCode: z.number().int().positive().optional(),
    languageCode: z.string().min(2).max(10).optional(),
    pageSize: z.number().int().min(10).max(1000).default(100),
    pageToken: z.string().min(1).optional(),
  })
  .refine(
    (value) => value.keywords.length > 0 || value.url !== undefined,
    "Provide at least one keyword or an HTTPS URL",
  );

export const getHistoricalMetricsInputSchema = z.object({
  projectId: z.string().min(1),
  keywords: z.array(keywordSchema).min(1).max(700),
  locationCode: z.number().int().positive().optional(),
  languageCode: z.string().min(2).max(10).optional(),
});

const googleIntegerSchema = z
  .union([z.number(), z.string()])
  .transform((value, ctx) => {
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(parsed)) {
      ctx.addIssue({ code: "custom", message: "Invalid Google numeric value" });
      return z.NEVER;
    }
    return parsed;
  });

const googleMonthlySearchSchema = z.object({
  year: googleIntegerSchema.optional(),
  month: z.union([z.string(), z.number()]).optional(),
  monthlySearches: googleIntegerSchema.optional(),
});

export const googleKeywordMetricsSchema = z.object({
  avgMonthlySearches: googleIntegerSchema.optional(),
  competition: z.string().optional(),
  competitionIndex: googleIntegerSchema.optional(),
  averageCpcMicros: googleIntegerSchema.optional(),
  lowTopOfPageBidMicros: googleIntegerSchema.optional(),
  highTopOfPageBidMicros: googleIntegerSchema.optional(),
  monthlySearchVolumes: z.array(googleMonthlySearchSchema).optional(),
});

export const googleKeywordIdeasResponseSchema = z.object({
  results: z
    .array(
      z.object({
        text: z.string(),
        keywordIdeaMetrics: googleKeywordMetricsSchema.optional(),
      }),
    )
    .optional(),
  nextPageToken: z.string().optional(),
  totalSize: googleIntegerSchema.optional(),
});

export const googleHistoricalMetricsResponseSchema = z.object({
  results: z
    .array(
      z.object({
        text: z.string(),
        closeVariants: z.array(z.string()).optional(),
        keywordMetrics: googleKeywordMetricsSchema.optional(),
      }),
    )
    .optional(),
});

export type GoogleKeywordMetrics = z.infer<typeof googleKeywordMetricsSchema>;
