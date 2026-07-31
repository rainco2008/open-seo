import type { z } from "zod";
import type { PersonalGoogleAdsConfig } from "../config";
import type {
  googleHistoricalMetricsResponseSchema,
  googleKeywordIdeasResponseSchema,
  GoogleKeywordMetrics,
} from "../schemas";
import type {
  GoogleAdsCompetitionLevel,
  PersonalGoogleAdsKeywordRow,
} from "../types";

const MONTH_NUMBERS: Record<string, number> = {
  JANUARY: 1,
  FEBRUARY: 2,
  MARCH: 3,
  APRIL: 4,
  MAY: 5,
  JUNE: 6,
  JULY: 7,
  AUGUST: 8,
  SEPTEMBER: 9,
  OCTOBER: 10,
  NOVEMBER: 11,
  DECEMBER: 12,
};

function microsToCurrency(value: number | undefined) {
  return value === undefined ? null : value / 1_000_000;
}

function normalizeCompetition(
  value: string | undefined,
): GoogleAdsCompetitionLevel {
  if (value === "LOW" || value === "MEDIUM" || value === "HIGH") return value;
  if (value === "UNSPECIFIED") return "UNSPECIFIED";
  return null;
}

function normalizeMonth(value: string | number | undefined) {
  if (typeof value === "number") return value >= 1 && value <= 12 ? value : 0;
  return value ? (MONTH_NUMBERS[value] ?? 0) : 0;
}

function mapMetrics(
  keyword: string,
  metrics: GoogleKeywordMetrics | undefined,
  config: PersonalGoogleAdsConfig,
  closeVariants: string[] = [],
): PersonalGoogleAdsKeywordRow {
  return {
    keyword: keyword.trim(),
    searchVolume: metrics?.avgMonthlySearches ?? null,
    monthlySearches: (metrics?.monthlySearchVolumes ?? []).map((entry) => ({
      year: entry.year ?? 0,
      month: normalizeMonth(entry.month),
      searchVolume: entry.monthlySearches ?? 0,
    })),
    competition:
      metrics?.competitionIndex === undefined
        ? null
        : metrics.competitionIndex / 100,
    competitionLevel: normalizeCompetition(metrics?.competition),
    averageCpc: microsToCurrency(metrics?.averageCpcMicros),
    lowTopOfPageBid: microsToCurrency(metrics?.lowTopOfPageBidMicros),
    highTopOfPageBid: microsToCurrency(metrics?.highTopOfPageBidMicros),
    closeVariants,
    currencyCode: config.currencyCode,
    source: "google_ads_api",
  };
}

export function mapKeywordIdeasResponse(
  response: z.infer<typeof googleKeywordIdeasResponseSchema>,
  config: PersonalGoogleAdsConfig,
) {
  return {
    rows: (response.results ?? [])
      .filter((result) => result.text.trim().length > 0)
      .map((result) =>
        mapMetrics(result.text, result.keywordIdeaMetrics, config),
      ),
    nextPageToken: response.nextPageToken ?? null,
    totalSize: response.totalSize ?? null,
  };
}

export function mapHistoricalMetricsResponse(
  response: z.infer<typeof googleHistoricalMetricsResponseSchema>,
  config: PersonalGoogleAdsConfig,
) {
  return (response.results ?? [])
    .filter((result) => result.text.trim().length > 0)
    .map((result) =>
      mapMetrics(
        result.text,
        result.keywordMetrics,
        config,
        result.closeVariants ?? [],
      ),
    );
}
