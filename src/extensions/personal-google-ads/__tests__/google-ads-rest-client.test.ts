import { describe, expect, it, vi } from "vitest";
import type { PersonalGoogleAdsConfig } from "../config";
import { createGoogleAdsRestClient } from "../server/google-ads-rest-client";

const config = {
  enabled: true,
  apiVersion: "v25",
  developerToken: "developer-token",
  refreshToken: "refresh-token",
  customerId: "1234567890",
  loginCustomerId: "0987654321",
  currencyCode: "GBP",
  clientId: "client-id",
  clientSecret: "client-secret",
} satisfies PersonalGoogleAdsConfig;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createGoogleAdsRestClient", () => {
  it("uses OAuth, Google Ads headers, market constants, and the selected seed", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ access_token: "access-token" }))
      .mockResolvedValueOnce(
        jsonResponse({ results: [{ text: "seo platform" }], totalSize: "1" }),
      );
    const client = createGoogleAdsRestClient(config, { fetcher });

    const result = await client.generateKeywordIdeas({
      keywords: ["seo"],
      url: "https://example.com",
      language: "languageConstants/1000",
      geoTargetConstants: ["geoTargetConstants/2826"],
      pageSize: 100,
    });

    expect(result.totalSize).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [url, init] = fetcher.mock.calls[1];
    expect(url).toBe(
      "https://googleads.googleapis.com/v25/customers/1234567890:generateKeywordIdeas",
    );
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer access-token",
      "developer-token": "developer-token",
      "login-customer-id": "0987654321",
    });
    if (typeof init?.body !== "string") {
      throw new Error("Expected a JSON string request body");
    }
    expect(JSON.parse(init.body)).toMatchObject({
      language: "languageConstants/1000",
      geoTargetConstants: ["geoTargetConstants/2826"],
      keywordAndUrlSeed: {
        keywords: ["seo"],
        url: "https://example.com",
      },
    });
  });

  it("retries a 401 once with a fresh token", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ access_token: "token-1" }))
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({ access_token: "token-2" }))
      .mockResolvedValueOnce(jsonResponse({ results: [] }));
    const sleep = vi.fn(async () => undefined);
    const client = createGoogleAdsRestClient(config, {
      fetcher,
      sleep,
      random: () => 0,
    });

    await client.generateHistoricalMetrics({
      keywords: ["seo"],
      language: "languageConstants/1000",
      geoTargetConstants: ["geoTargetConstants/2826"],
    });

    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledTimes(1);
  });
});
