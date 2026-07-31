export type GoogleAdsCompetitionLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "UNSPECIFIED"
  | null;

export type GoogleAdsMonthlySearch = {
  year: number;
  month: number;
  searchVolume: number;
};

export type PersonalGoogleAdsKeywordRow = {
  keyword: string;
  searchVolume: number | null;
  monthlySearches: GoogleAdsMonthlySearch[];
  competition: number | null;
  competitionLevel: GoogleAdsCompetitionLevel;
  averageCpc: number | null;
  lowTopOfPageBid: number | null;
  highTopOfPageBid: number | null;
  closeVariants: string[];
  currencyCode: string;
  source: "google_ads_api";
};

export type PlannerMarket = {
  locationCode: number;
  languageCode: string;
};
