import { z } from "zod";
import type { PersonalGoogleAdsConfig } from "../config";
import {
  googleHistoricalMetricsResponseSchema,
  googleKeywordIdeasResponseSchema,
} from "../schemas";
import { fetchGoogleAdsAccessToken } from "./access-token";
import {
  GoogleAdsApiError,
  type GoogleAdsErrorKind,
} from "./google-ads-errors";

type RestClientDependencies = {
  fetcher?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
};

const MAX_ATTEMPTS = 3;

const googleAdsErrorResponseSchema = z.object({
  error: z.object({
    message: z.string().optional(),
    status: z.string().optional(),
    details: z
      .array(
        z.object({
          requestId: z.string().optional(),
          errors: z
            .array(
              z.object({
                message: z.string().optional(),
                errorCode: z.record(z.string(), z.string()).optional(),
              }),
            )
            .optional(),
        }),
      )
      .optional(),
  }),
});

function parseGoogleAdsError(payload: unknown) {
  const parsed = googleAdsErrorResponseSchema.safeParse(payload);
  if (!parsed.success) return {};

  const details = parsed.data.error.details ?? [];
  const failure = details.find((detail) => detail.errors?.length);
  const firstError = failure?.errors?.[0];
  const errorCode = firstError?.errorCode
    ? Object.values(firstError.errorCode).find(Boolean)
    : undefined;

  return {
    status: parsed.data.error.status,
    errorCode,
    message: firstError?.message ?? parsed.data.error.message,
    requestId: details.find((detail) => detail.requestId)?.requestId,
  };
}

function defaultSleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function classifyError(status: number): GoogleAdsErrorKind {
  if (status === 401) return "authentication";
  if (status === 403) return "permission";
  if (status === 400) return "validation";
  if (status === 429) return "rate_limit";
  return "upstream";
}

function retryDelay(response: Response, attempt: number, random: () => number) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  }
  return 500 * 2 ** attempt + Math.floor(random() * 250);
}

export function createGoogleAdsRestClient(
  config: PersonalGoogleAdsConfig,
  dependencies: RestClientDependencies = {},
) {
  const fetcher = dependencies.fetcher ?? fetch;
  const sleep = dependencies.sleep ?? defaultSleep;
  const random = dependencies.random ?? Math.random;
  const baseUrl = `https://googleads.googleapis.com/${config.apiVersion}`;

  async function request(path: string, body: Record<string, unknown>) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const accessToken = await fetchGoogleAdsAccessToken(config, fetcher);
      let response: Response;
      try {
        response = await fetcher(`${baseUrl}${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "developer-token": config.developerToken,
            ...(config.loginCustomerId
              ? { "login-customer-id": config.loginCustomerId }
              : {}),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30_000),
        });
      } catch {
        if (attempt < MAX_ATTEMPTS - 1) {
          await sleep(500 * 2 ** attempt + Math.floor(random() * 250));
          continue;
        }
        throw new GoogleAdsApiError(
          "upstream",
          "Could not reach the Google Ads API.",
          503,
        );
      }

      const payload: unknown = await response.json().catch(() => null);
      if (response.ok) return payload;

      const parsedError = parseGoogleAdsError(payload);
      const requestId =
        response.headers.get("request-id") ?? parsedError.requestId;

      // A 401 gets one fresh-token retry. Quota and transient upstream errors
      // get the full bounded backoff window.
      const retryable =
        (response.status === 401 && attempt === 0) ||
        response.status === 429 ||
        response.status >= 500;
      if (retryable && attempt < MAX_ATTEMPTS - 1) {
        await sleep(retryDelay(response, attempt, random));
        continue;
      }

      console.error(
        JSON.stringify({
          event: "google_ads_api_error",
          httpStatus: response.status,
          status: parsedError.status,
          errorCode: parsedError.errorCode,
          message: parsedError.message,
          requestId,
        }),
      );

      throw new GoogleAdsApiError(
        classifyError(response.status),
        response.status === 429
          ? "Google Ads Keyword Planner rate limit reached. Try again shortly."
          : `Google Ads API request failed (${response.status}).`,
        response.status,
        requestId,
      );
    }

    throw new GoogleAdsApiError(
      "upstream",
      "Google Ads API request failed after retries.",
      503,
    );
  }

  return {
    async generateKeywordIdeas(input: {
      keywords: string[];
      url?: string;
      language: string;
      geoTargetConstants: string[];
      pageSize: number;
      pageToken?: string;
    }) {
      const seed =
        input.keywords.length > 0 && input.url
          ? { keywordAndUrlSeed: { keywords: input.keywords, url: input.url } }
          : input.url
            ? { urlSeed: { url: input.url } }
            : { keywordSeed: { keywords: input.keywords } };
      const payload = await request(
        `/customers/${config.customerId}:generateKeywordIdeas`,
        {
          language: input.language,
          geoTargetConstants: input.geoTargetConstants,
          includeAdultKeywords: false,
          keywordPlanNetwork: "GOOGLE_SEARCH",
          historicalMetricsOptions: { includeAverageCpc: true },
          pageSize: input.pageSize,
          ...(input.pageToken ? { pageToken: input.pageToken } : {}),
          ...seed,
        },
      );
      return googleKeywordIdeasResponseSchema.parse(payload);
    },

    async generateHistoricalMetrics(input: {
      keywords: string[];
      language: string;
      geoTargetConstants: string[];
    }) {
      const payload = await request(
        `/customers/${config.customerId}:generateKeywordHistoricalMetrics`,
        {
          keywords: input.keywords,
          language: input.language,
          geoTargetConstants: input.geoTargetConstants,
          keywordPlanNetwork: "GOOGLE_SEARCH",
          historicalMetricsOptions: { includeAverageCpc: true },
        },
      );
      return googleHistoricalMetricsResponseSchema.parse(payload);
    },
  };
}
