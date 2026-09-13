import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  requireProjectContext,
  requireAuthenticatedContext,
} from "@/serverFunctions/middleware";
import { Ga4PortfolioService } from "@/server/features/ga4/services/Ga4PortfolioService";
import { Ga4OrganicOverviewService } from "@/server/features/ga4/services/Ga4OrganicOverviewService";
import { Ga4ReportingService } from "@/server/features/ga4/services/Ga4ReportingService";
import { Ga4ReportError } from "@/server/lib/ga4Errors";

function analyticsFailure(error: unknown) {
  if (!(error instanceof Ga4ReportError)) throw error;
  return { error: { code: error.code, message: error.message } };
}

const rangeSchema = z.object({
  projectId: z.string().min(1),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  channel: z.enum(["all", "organic_search"]).default("all"),
});

export const getAnalyticsPortfolio = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(
    rangeSchema
      .omit({ projectId: true, channel: true })
      .extend({
        comparison: z
          .enum(["previous_period", "previous_week"])
          .default("previous_period"),
      }),
  )
  .handler(({ data, context }) =>
    Ga4PortfolioService.getPortfolio(context.organizationId, data),
  );

export const getAnalyticsOverview = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(
    rangeSchema.extend({
      comparison: z
        .enum(["previous_period", "previous_week"])
        .default("previous_period"),
    }),
  )
  .handler(async ({ data, context }) => {
    try {
      return await Ga4OrganicOverviewService.getTrafficOverview({
        ...data,
        projectId: context.projectId,
      });
    } catch (error) {
      return analyticsFailure(error);
    }
  });

export const getAnalyticsReport = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(
    rangeSchema.extend({
      kind: z.enum([
        "landing_pages",
        "page_performance",
        "events",
        "key_events",
        "traffic_acquisition",
        "audience_breakdown",
      ]),
      acquisitionBreakdown: z
        .enum(["channel_group", "source_medium", "campaign", "utm"])
        .optional(),
      audienceBreakdown: z
        .enum(["device", "country", "browser", "new_vs_returning"])
        .optional(),
      offset: z.number().int().min(0).default(0),
      limit: z.number().int().min(1).max(100).default(25),
    }),
  )
  .handler(async ({ data, context }) => {
    try {
      const report = await Ga4ReportingService.runReport({
        ...data,
        projectId: context.projectId,
      });
      return {
        request: report.request,
        rows: report.rows,
        totalRowCount: report.totalRowCount,
        pageInfo: report.pageInfo,
        reportMetadata: report.reportMetadata,
        warnings: report.warnings,
      };
    } catch (error) {
      return analyticsFailure(error);
    }
  });
