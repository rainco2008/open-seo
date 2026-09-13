import { Ga4ConnectionRepository } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import { createGa4DataClient } from "@/server/lib/ga4Client";
import {
  buildGa4OverviewRequest,
  OVERVIEW_METRICS,
} from "./Ga4ReportDefinitions";
import { normalizeGa4Response } from "./Ga4ReportNormalization";
import { comparisonValue, previousPeriod } from "./Ga4ReportEnhancements";
import { Ga4ReportError } from "@/server/lib/ga4Errors";
import { mapGa4ReportError, resolveGa4DateRange } from "./Ga4ReportingService";
import type { Ga4Channel } from "./Ga4ReportDefinitions";
import { shiftGa4Date } from "./Ga4Dates";

const TRAFFIC_METRICS = [
  "totalUsers",
  "sessions",
  "screenPageViews",
  "keyEvents",
  "newUsers",
  "engagementRate",
  "bounceRate",
  "averageSessionDuration",
] as const;

type Ga4OrganicOverviewInput = {
  projectId: string;
  startDate?: string;
  endDate?: string;
  trend?: "daily" | "weekly";
};

function metricComparison(
  current: Record<string, string | number | null> | null,
  previous: Record<string, string | number | null> | null,
  metrics: readonly string[],
) {
  return Object.fromEntries(
    metrics.map((metric) => {
      const currentValue =
        typeof current?.[metric] === "number" ? current[metric] : null;
      const previousValue =
        typeof previous?.[metric] === "number" ? previous[metric] : null;
      return [metric, comparisonValue(currentValue, previousValue)];
    }),
  );
}

function keyEventDiagnostics(
  current: Record<string, string | number | null> | null,
  previous: Record<string, string | number | null> | null,
  hasLimitedData: boolean,
) {
  if (hasLimitedData) return [];
  const currentValue =
    typeof current?.keyEvents === "number" ? current.keyEvents : null;
  const previousValue =
    typeof previous?.keyEvents === "number" ? previous.keyEvents : null;
  if (currentValue == null || previousValue == null || previousValue < 5) {
    return [];
  }
  const percentChange = (currentValue - previousValue) / previousValue;
  if (percentChange > -0.5) return [];
  return [
    {
      code: "key_events_sharp_decline",
      severity: "warning",
      message:
        "Organic key events declined sharply compared with the previous equal-length period.",
      evidence: {
        current: currentValue,
        previous: previousValue,
        percentChange,
      },
      threshold: { minimumPreviousKeyEvents: 5, percentChange: -0.5 },
    },
  ];
}

async function getOrganicOverview(
  input: Ga4OrganicOverviewInput,
  opts: {
    now?: Date;
    channel?: Ga4Channel;
    metrics?: readonly string[];
    comparison?: "previous_period" | "previous_week";
  } = {},
) {
  const connection = await Ga4ConnectionRepository.getByProjectId(
    input.projectId,
  );
  if (!connection) {
    throw new Ga4ReportError(
      "ga4_not_connected",
      "Google Analytics is not connected for this project.",
    );
  }
  const dateRange = resolveGa4DateRange(
    input,
    connection.propertyTimeZone,
    opts.now,
  );
  const previousDateRange =
    opts.comparison === "previous_week"
      ? {
          startDate: shiftGa4Date(dateRange.resolvedDateRange.startDate, -7),
          endDate: shiftGa4Date(dateRange.resolvedDateRange.endDate, -7),
        }
      : previousPeriod(dateRange.resolvedDateRange);
  const channel = opts.channel ?? "organic_search";
  const metrics = opts.metrics ?? OVERVIEW_METRICS;
  const currentRequest = buildGa4OverviewRequest({
    ...dateRange.resolvedDateRange,
    channel,
    metrics,
  });
  const previousRequest = buildGa4OverviewRequest({
    ...previousDateRange,
    channel,
    metrics,
  });
  const trend = input.trend ?? "daily";
  const trendRequest = buildGa4OverviewRequest({
    ...dateRange.resolvedDateRange,
    trend,
    channel,
    metrics,
  });
  const client = createGa4DataClient({
    userId: connection.connectedByUserId,
    ga4AccountId: connection.ga4AccountId,
    propertyId: connection.propertyId,
  });

  try {
    const [currentResponse, previousResponse, trendResponse] =
      await Promise.all([
        client.runReport(currentRequest),
        client.runReport(previousRequest),
        client.runReport(trendRequest),
      ]);
    const current = normalizeGa4Response(currentResponse, currentRequest);
    const previous = normalizeGa4Response(previousResponse, previousRequest);
    const trendReport = normalizeGa4Response(trendResponse, trendRequest);
    const currentSummary = current.rows[0] ?? null;
    const previousSummary = previous.rows[0] ?? null;
    const reports = [current, previous, trendReport];
    const hasLimitedData = reports.some(
      (report) => report.reportMetadata.hasLimitedData,
    );
    return {
      status: "ok" as const,
      source: {
        provider: "google_analytics" as const,
        propertyId: connection.propertyId,
        propertyDisplayName: connection.propertyDisplayName,
      },
      request: {
        requestedDateRange: dateRange.requestedDateRange,
        resolvedDateRange: dateRange.resolvedDateRange,
        previousDateRange,
        propertyTimeZone: connection.propertyTimeZone,
        currencyCode: connection.propertyCurrencyCode,
        channel,
        trend,
      },
      current: currentSummary,
      previous: previousSummary,
      comparison: metricComparison(currentSummary, previousSummary, metrics),
      trend: trendReport.rows,
      diagnostics: keyEventDiagnostics(
        currentSummary,
        previousSummary,
        hasLimitedData,
      ),
      reportMetadata: {
        hasLimitedData,
        reports: reports.map((report) => report.reportMetadata),
      },
      quota: trendReport.quota ?? current.quota,
      warnings: [
        ...dateRange.warnings,
        ...(trendReport.totalRowCount > trendReport.rows.length
          ? ["trend_truncated"]
          : []),
      ],
    };
  } catch (error) {
    mapGa4ReportError(error);
  }
}

async function getTrafficOverview(
  input: Ga4OrganicOverviewInput & {
    channel?: Ga4Channel;
    comparison?: "previous_period" | "previous_week";
  },
  opts: { now?: Date } = {},
) {
  const result = await getOrganicOverview(input, {
    ...opts,
    channel: input.channel ?? "all",
    metrics: TRAFFIC_METRICS,
    comparison: input.comparison,
  });
  return {
    ...result,
    diagnostics: result.diagnostics.map((finding) => ({
      ...finding,
      message:
        "Key events declined sharply compared with the selected comparison period.",
    })),
    trafficAlerts:
      !result.reportMetadata.hasLimitedData &&
      result.comparison.sessions.previous !== null &&
      result.comparison.sessions.previous >= 100 &&
      result.comparison.sessions.percentChange !== null &&
      Math.abs(result.comparison.sessions.percentChange) >= 0.5
        ? [
            {
              code: "sessions_large_change",
              message: `Sessions ${result.comparison.sessions.percentChange < 0 ? "fell" : "rose"} by ${Math.abs(result.comparison.sessions.percentChange * 100).toFixed(1)}% compared with the selected comparison period. Check channels, campaigns and measurement before drawing conclusions.`,
            },
          ]
        : [],
  };
}

export const Ga4OrganicOverviewService = {
  getOrganicOverview,
  getTrafficOverview,
};
