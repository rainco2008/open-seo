import { describe, expect, it } from "vitest";
import type { PersonalGoogleAdsConfig } from "../config";
import { mapKeywordIdeasResponse } from "../server/keyword-planner-mapper";

const config = {
  enabled: true,
  apiVersion: "v25",
  developerToken: "developer-token",
  refreshToken: "refresh-token",
  customerId: "1234567890",
  currencyCode: "GBP",
  clientId: "client-id",
  clientSecret: "client-secret",
} satisfies PersonalGoogleAdsConfig;

describe("mapKeywordIdeasResponse", () => {
  it("normalizes Google values and micros", () => {
    const result = mapKeywordIdeasResponse(
      {
        totalSize: 1,
        results: [
          {
            text: "seo tools",
            keywordIdeaMetrics: {
              avgMonthlySearches: 1200,
              competition: "MEDIUM",
              competitionIndex: 54,
              averageCpcMicros: 1750000,
              lowTopOfPageBidMicros: 900000,
              highTopOfPageBidMicros: 2400000,
              monthlySearchVolumes: [
                { year: 2026, month: "JUNE", monthlySearches: 1300 },
              ],
            },
          },
        ],
      },
      config,
    );

    expect(result.rows[0]).toMatchObject({
      keyword: "seo tools",
      searchVolume: 1200,
      competition: 0.54,
      competitionLevel: "MEDIUM",
      averageCpc: 1.75,
      lowTopOfPageBid: 0.9,
      highTopOfPageBid: 2.4,
      currencyCode: "GBP",
      source: "google_ads_api",
      monthlySearches: [{ year: 2026, month: 6, searchVolume: 1300 }],
    });
  });
});
