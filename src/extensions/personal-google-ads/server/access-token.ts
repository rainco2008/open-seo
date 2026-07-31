import { z } from "zod";
import type { PersonalGoogleAdsConfig } from "../config";
import { GoogleAdsApiError } from "./google-ads-errors";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().optional(),
  token_type: z.string().optional(),
});

const tokenErrorSchema = z.object({
  error: z.string().optional(),
});

export async function fetchGoogleAdsAccessToken(
  config: PersonalGoogleAdsConfig,
  fetcher: typeof fetch = fetch,
) {
  let response: Response;
  try {
    response = await fetcher("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new GoogleAdsApiError(
      "upstream",
      "Could not reach Google's OAuth service.",
      503,
    );
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = tokenErrorSchema.safeParse(payload);
    const invalidGrant =
      parsed.success && parsed.data.error === "invalid_grant";
    throw new GoogleAdsApiError(
      "authentication",
      invalidGrant
        ? "Google Ads authorization expired. Generate a new refresh token."
        : "Google rejected the configured OAuth credentials.",
      response.status,
    );
  }

  const parsed = tokenResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new GoogleAdsApiError(
      "authentication",
      "Google returned an invalid OAuth token response.",
      response.status,
    );
  }
  return parsed.data.access_token;
}
