import { z } from "zod";
import { ProjectDailyMetricsRepository } from "@/server/features/portfolio/repositories/ProjectDailyMetricsRepository";
import { mcpResponse } from "@/server/mcp/formatters";
import { withMcpProjectAuth } from "@/server/mcp/project-auth";
import { buildProjectMeta } from "@/server/mcp/context";

const inputSchema = { projectId: z.string().min(1) };

export const getDailyProjectReportTool = {
  name: "get_daily_project_report",
  config: {
    title: "Get daily project report",
    description:
      "Returns the latest stable daily GA4 and Google Search Console metrics for one authorized project. Use this for a concise traffic, conversion, and search-performance update without spending credits.",
    inputSchema,
    outputSchema: {
      metricDate: z.string().nullable(),
      ga4Sessions: z.number().nullable(),
      ga4Users: z.number().nullable(),
      ga4PageViews: z.number().nullable(),
      ga4KeyEvents: z.number().nullable(),
      gscClicks: z.number().nullable(),
      gscImpressions: z.number().nullable(),
      gscCtr: z.string().nullable(),
      gscPosition: z.string().nullable(),
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      destructiveHint: false,
    },
  },
  handler: withMcpProjectAuth(async (args, context) => {
    const report = await ProjectDailyMetricsRepository.getForProjectDate(
      args.projectId,
      new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
    );
    const values = report
      ? {
          metricDate: report.metricDate,
          ga4Sessions: report.ga4Sessions,
          ga4Users: report.ga4Users,
          ga4PageViews: report.ga4PageViews,
          ga4KeyEvents: report.ga4KeyEvents,
          gscClicks: report.gscClicks,
          gscImpressions: report.gscImpressions,
          gscCtr: report.gscCtr,
          gscPosition: report.gscPosition,
        }
      : {
          metricDate: null,
          ga4Sessions: null,
          ga4Users: null,
          ga4PageViews: null,
          ga4KeyEvents: null,
          gscClicks: null,
          gscImpressions: null,
          gscCtr: null,
          gscPosition: null,
        };
    return mcpResponse({
      text: report
        ? `Daily report ${report.metricDate}: sessions ${report.ga4Sessions ?? "—"}, users ${report.ga4Users ?? "—"}, conversions ${report.ga4KeyEvents ?? "—"}, clicks ${report.gscClicks ?? "—"}.`
        : "No finalized daily report is available yet.",
      meta: buildProjectMeta(
        { baseUrl: context.baseUrl },
        args.projectId,
        `/p/${args.projectId}/analytics`,
      ),
      structuredContent: values,
    });
  }),
};
