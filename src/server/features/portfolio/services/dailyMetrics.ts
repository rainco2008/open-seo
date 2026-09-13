import { isNull } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { Ga4OrganicOverviewService } from "@/server/features/ga4/services/Ga4OrganicOverviewService";
import { GscService } from "@/server/features/gsc/services/GscService";
import { ProjectDailyMetricsRepository } from "../repositories/ProjectDailyMetricsRepository";

function latestFinalDate() {
  const date = new Date();
  // Search Console finalizes data about three days late. Capturing the same
  // stable date for both sources keeps portfolio comparisons honest.
  date.setUTCDate(date.getUTCDate() - 3);
  return date.toISOString().slice(0, 10);
}

export async function captureDailyPortfolioMetrics(
  metricDate = latestFinalDate(),
) {
  const rows = await db
    .select({ id: projects.id, organizationId: projects.organizationId })
    .from(projects)
    .where(isNull(projects.archivedAt));
  for (const project of rows) {
    let ga4: Record<string, string | number | null> | null = null;
    let gsc: {
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    } | null = null;
    try {
      ga4 = (
        await Ga4OrganicOverviewService.getTrafficOverview({
          projectId: project.id,
          startDate: metricDate,
          endDate: metricDate,
        })
      ).current;
    } catch {
      /* Connection and quota failures are recorded as unavailable. */
    }
    try {
      const result = await GscService.getPerformance({
        projectId: project.id,
        startDate: metricDate,
        endDate: metricDate,
        dimensions: ["date"],
        rowLimit: 1,
        dataState: "final",
      });
      const value = result.rows[0];
      if (value)
        gsc = {
          clicks: value.clicks,
          impressions: value.impressions,
          ctr: value.ctr,
          position: value.position,
        };
    } catch {
      /* GSC final data can lag; preserve the independently available GA4 row. */
    }
    await ProjectDailyMetricsRepository.upsert({
      projectId: project.id,
      organizationId: project.organizationId,
      metricDate,
      ga4Users: typeof ga4?.totalUsers === "number" ? ga4.totalUsers : null,
      ga4Sessions: typeof ga4?.sessions === "number" ? ga4.sessions : null,
      ga4PageViews:
        typeof ga4?.screenPageViews === "number" ? ga4.screenPageViews : null,
      ga4KeyEvents: typeof ga4?.keyEvents === "number" ? ga4.keyEvents : null,
      gscClicks: gsc?.clicks ?? null,
      gscImpressions: gsc?.impressions ?? null,
      gscCtr: gsc ? String(gsc.ctr) : null,
      gscPosition: gsc ? String(gsc.position) : null,
      capturedAt: new Date().toISOString(),
    });
  }
}
