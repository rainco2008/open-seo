import { AppError } from "@/server/lib/errors";
import type { PersonalGoogleAdsConfig } from "../config";
import type { PersonalGoogleAdsKeywordRow, PlannerMarket } from "../types";
import { createGoogleAdsRestClient } from "./google-ads-rest-client";
import {
  mapHistoricalMetricsResponse,
  mapKeywordIdeasResponse,
} from "./keyword-planner-mapper";
import { resolveGoogleAdsMarket } from "./market-constants";

const HISTORICAL_METRICS_BATCH_SIZE = 700;

function normalizeKeywords(keywords: string[]) {
  const seen = new Set<string>();
  return keywords.flatMap((keyword) => {
    const normalized = keyword.trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) return [];
    seen.add(key);
    return [normalized];
  });
}

export function createKeywordPlannerService(config: PersonalGoogleAdsConfig) {
  const client = createGoogleAdsRestClient(config);

  return {
    async generateIdeas(input: {
      keywords: string[];
      url?: string;
      market: PlannerMarket;
      pageSize: number;
      pageToken?: string;
    }) {
      const keywords = normalizeKeywords(input.keywords);
      if (keywords.length === 0 && !input.url) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Provide at least one keyword or URL.",
        );
      }
      const market = resolveGoogleAdsMarket(input.market);
      return mapKeywordIdeasResponse(
        await client.generateKeywordIdeas({
          keywords,
          url: input.url,
          pageSize: input.pageSize,
          pageToken: input.pageToken,
          ...market,
        }),
        config,
      );
    },

    async getHistoricalMetrics(input: {
      keywords: string[];
      market: PlannerMarket;
    }) {
      const keywords = normalizeKeywords(input.keywords);
      const market = resolveGoogleAdsMarket(input.market);
      const rows: PersonalGoogleAdsKeywordRow[] = [];
      for (
        let offset = 0;
        offset < keywords.length;
        offset += HISTORICAL_METRICS_BATCH_SIZE
      ) {
        const response = await client.generateHistoricalMetrics({
          keywords: keywords.slice(
            offset,
            offset + HISTORICAL_METRICS_BATCH_SIZE,
          ),
          ...market,
        });
        rows.push(...mapHistoricalMetricsResponse(response, config));
      }
      return { rows };
    },
  };
}
