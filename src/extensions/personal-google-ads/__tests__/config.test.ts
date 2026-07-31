import { describe, expect, it } from "vitest";
import { parsePersonalGoogleAdsConfig } from "../config";

const rawConfig = JSON.stringify({
  developerToken: "developer-token",
  refreshToken: "refresh-token",
  customerId: "123-456-7890",
  currencyCode: "gbp",
});

describe("parsePersonalGoogleAdsConfig", () => {
  it("combines extension config with the existing OAuth client", () => {
    expect(
      parsePersonalGoogleAdsConfig({
        rawConfig,
        clientId: "client-id",
        clientSecret: "client-secret",
      }),
    ).toEqual({
      status: "ready",
      config: {
        enabled: true,
        apiVersion: "v25",
        developerToken: "developer-token",
        refreshToken: "refresh-token",
        customerId: "1234567890",
        currencyCode: "GBP",
        clientId: "client-id",
        clientSecret: "client-secret",
      },
    });
  });

  it("fails closed without affecting application startup", () => {
    expect(
      parsePersonalGoogleAdsConfig({
        rawConfig: "not-json",
        clientId: "client-id",
        clientSecret: "client-secret",
      }),
    ).toEqual({ status: "invalid", reason: "invalid_json" });
    expect(
      parsePersonalGoogleAdsConfig({
        rawConfig: undefined,
        clientId: undefined,
        clientSecret: undefined,
      }),
    ).toEqual({ status: "disabled", reason: "missing" });
  });
});
