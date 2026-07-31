import { createServerFn } from "@tanstack/react-start";
import { AppError } from "@/server/lib/errors";
import {
  getPersonalGoogleAdsConfigState,
  maskGoogleAdsCustomerId,
} from "./config";
import {
  generateKeywordIdeasInputSchema,
  getHistoricalMetricsInputSchema,
  plannerStatusInputSchema,
} from "./schemas";
import { requireProjectContext, resolveMarket } from "./bridge/openseo";
import { createKeywordPlannerService } from "./server/KeywordPlannerService";
import { supportsGoogleAdsLanguage } from "./server/market-constants";
import { toGoogleAdsAppError } from "./server/google-ads-errors";

function messageForConfigState(
  state: Awaited<ReturnType<typeof getPersonalGoogleAdsConfigState>>,
) {
  if (state.status === "invalid") {
    return "Google Ads configuration is invalid. Check PERSONAL_GOOGLE_ADS_CONFIG and the existing Google OAuth variables.";
  }
  if (state.status === "disabled" && state.reason === "disabled") {
    return "Google Ads Keyword Planner is disabled in PERSONAL_GOOGLE_ADS_CONFIG.";
  }
  return "Set PERSONAL_GOOGLE_ADS_CONFIG to enable Google Ads Keyword Planner.";
}

async function requireConfig() {
  const state = await getPersonalGoogleAdsConfigState();
  if (state.status !== "ready") {
    throw new AppError("AUTH_CONFIG_MISSING", messageForConfigState(state));
  }
  return state.config;
}

export const getPersonalGoogleAdsPlannerStatus = createServerFn({
  method: "GET",
})
  .middleware(requireProjectContext)
  .validator(plannerStatusInputSchema)
  .handler(async ({ context }) => {
    const state = await getPersonalGoogleAdsConfigState();
    const market = resolveMarket({}, context.project);
    if (state.status !== "ready") {
      return {
        ready: false as const,
        message: messageForConfigState(state),
        market,
      };
    }
    if (!supportsGoogleAdsLanguage(market.languageCode)) {
      return {
        ready: false as const,
        message: `The project's language '${market.languageCode}' is not supported by Google Ads Keyword Planner.`,
        market,
      };
    }
    return {
      ready: true as const,
      customerId: maskGoogleAdsCustomerId(state.config.customerId),
      currencyCode: state.config.currencyCode,
      apiVersion: state.config.apiVersion,
      market,
    };
  });

export const generatePersonalGoogleAdsKeywordIdeas = createServerFn({
  method: "POST",
})
  .middleware(requireProjectContext)
  .validator(generateKeywordIdeasInputSchema)
  .handler(async ({ data, context }) => {
    try {
      const config = await requireConfig();
      return await createKeywordPlannerService(config).generateIdeas({
        keywords: data.keywords,
        url: data.url,
        pageSize: data.pageSize,
        pageToken: data.pageToken,
        market: resolveMarket(data, context.project),
      });
    } catch (error) {
      throw toGoogleAdsAppError(error);
    }
  });

export const getPersonalGoogleAdsHistoricalMetrics = createServerFn({
  method: "POST",
})
  .middleware(requireProjectContext)
  .validator(getHistoricalMetricsInputSchema)
  .handler(async ({ data, context }) => {
    try {
      const config = await requireConfig();
      return await createKeywordPlannerService(config).getHistoricalMetrics({
        keywords: data.keywords,
        market: resolveMarket(data, context.project),
      });
    } catch (error) {
      throw toGoogleAdsAppError(error);
    }
  });
