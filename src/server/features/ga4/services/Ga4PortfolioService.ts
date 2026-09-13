import { ProjectService } from "@/server/features/projects/services/ProjectService";
import { Ga4ConnectionRepository } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import { Ga4OrganicOverviewService } from "./Ga4OrganicOverviewService";
import { Ga4ReportError } from "@/server/lib/ga4Errors";

const metrics = [
  "totalUsers",
  "sessions",
  "screenPageViews",
  "keyEvents",
] as const;
type Metric = (typeof metrics)[number];
type Totals = Record<Metric, number | null>;
type PortfolioRow = {
  projectId: string;
  name: string;
  propertyId: string | null;
  status: string;
  current: Totals | null;
  previous: Totals | null;
  alerts: string[];
  timeZone: string | null;
  range: { startDate: string; endDate: string } | null;
};

const totals = (
  values: Record<string, string | number | null> | null,
): Totals => ({
  totalUsers: typeof values?.totalUsers === "number" ? values.totalUsers : null,
  sessions: typeof values?.sessions === "number" ? values.sessions : null,
  screenPageViews:
    typeof values?.screenPageViews === "number" ? values.screenPageViews : null,
  keyEvents: typeof values?.keyEvents === "number" ? values.keyEvents : null,
});

async function getPortfolio(
  organizationId: string,
  input: {
    startDate?: string;
    endDate?: string;
    comparison: "previous_period" | "previous_week";
  },
) {
  const projects = await ProjectService.listProjects(organizationId);
  const rows: PortfolioRow[] = [];
  const seenProperties = new Set<string>();
  // Sequential reporting avoids bursting Google's per-property quota when many
  // projects share a grant. A failed property does not hide healthy properties.
  for (const project of projects) {
    const connection = await Ga4ConnectionRepository.getByProjectId(project.id);
    const row: PortfolioRow = {
      projectId: project.id,
      name: project.name,
      propertyId: connection?.propertyId ?? null,
      status: "Not connected",
      current: null,
      previous: null,
      alerts: [],
      timeZone: connection?.propertyTimeZone ?? null,
      range: null,
    };
    rows.push(row);
    if (!connection) continue;
    if (seenProperties.has(connection.propertyId)) {
      row.status = "Shared property — counted once";
      continue;
    }
    try {
      const report = await Ga4OrganicOverviewService.getTrafficOverview({
        ...input,
        projectId: project.id,
        channel: "all",
      });
      seenProperties.add(connection.propertyId);
      row.status = report.reportMetadata.hasLimitedData
        ? "Limited data"
        : report.current
          ? "OK"
          : "No reported data";
      row.range = report.request.resolvedDateRange;
      row.current = totals(report.current);
      row.previous = totals(report.previous);
      row.alerts = [...report.trafficAlerts, ...report.diagnostics].map(
        (alert) => alert.message,
      );
    } catch (error) {
      if (!(error instanceof Ga4ReportError)) throw error;
      row.status = error.message;
    }
  }
  const sum = (period: "current" | "previous", metric: Metric) => {
    const values = rows.flatMap((row) =>
      typeof row[period]?.[metric] === "number" ? [row[period][metric]] : [],
    );
    return {
      value: values.length
        ? values.reduce((total, value) => total + value, 0)
        : null,
      properties: values.length,
    };
  };
  return {
    rows,
    totals: metrics.map((metric) => ({
      metric,
      current: sum("current", metric),
      previous: sum("previous", metric),
    })),
    countedProperties: seenProperties.size,
  };
}

export const Ga4PortfolioService = { getPortfolio };
