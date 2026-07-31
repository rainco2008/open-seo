import { AppError } from "@/server/lib/errors";
import type { PlannerMarket } from "../types";

// Google Ads targetable language criterion IDs. Keep this extension-local so
// upstream OpenSEO's DataForSEO market table remains untouched.
const GOOGLE_ADS_LANGUAGE_IDS: Record<string, number> = {
  ar: 1019,
  bg: 1020,
  bn: 1056,
  ca: 1038,
  cs: 1021,
  da: 1009,
  de: 1001,
  el: 1022,
  en: 1000,
  es: 1003,
  et: 1043,
  fa: 1064,
  fi: 1011,
  fr: 1002,
  gu: 1072,
  he: 1027,
  hi: 1023,
  hr: 1039,
  hu: 1024,
  id: 1025,
  is: 1026,
  it: 1004,
  ja: 1005,
  kn: 1086,
  ko: 1012,
  lt: 1029,
  lv: 1028,
  ml: 1098,
  mr: 1101,
  ms: 1102,
  nb: 1013,
  nl: 1010,
  no: 1013,
  pa: 1110,
  pl: 1030,
  pt: 1014,
  "pt-BR": 1014,
  "pt-PT": 1014,
  ro: 1032,
  ru: 1031,
  sk: 1033,
  sl: 1034,
  sr: 1035,
  sv: 1015,
  ta: 1130,
  te: 1131,
  th: 1044,
  tl: 1042,
  tr: 1037,
  uk: 1036,
  ur: 1041,
  vi: 1040,
  "zh-CN": 1017,
  "zh-TW": 1018,
};

export function resolveGoogleAdsMarket(market: PlannerMarket) {
  const languageId = GOOGLE_ADS_LANGUAGE_IDS[market.languageCode];
  if (!languageId) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Google Ads Keyword Planner does not support language '${market.languageCode}'.`,
    );
  }

  return {
    geoTargetConstants: [`geoTargetConstants/${market.locationCode}`],
    language: `languageConstants/${languageId}`,
  };
}

export function supportsGoogleAdsLanguage(languageCode: string) {
  return GOOGLE_ADS_LANGUAGE_IDS[languageCode] !== undefined;
}
