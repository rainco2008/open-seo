export const reports = {
  channels: {
    label: "Channels",
    kind: "traffic_acquisition",
    acquisitionBreakdown: "channel_group",
  },
  sources: {
    label: "Sources / media",
    kind: "traffic_acquisition",
    acquisitionBreakdown: "source_medium",
  },
  campaigns: {
    label: "Campaigns",
    kind: "traffic_acquisition",
    acquisitionBreakdown: "campaign",
  },
  utm: {
    label: "UTM parameters",
    kind: "traffic_acquisition",
    acquisitionBreakdown: "utm",
  },
  pages: { label: "Top pages", kind: "page_performance" },
  entrances: { label: "Landing pages", kind: "landing_pages" },
  devices: {
    label: "Devices",
    kind: "audience_breakdown",
    audienceBreakdown: "device",
  },
  countries: {
    label: "Countries",
    kind: "audience_breakdown",
    audienceBreakdown: "country",
  },
  browsers: {
    label: "Browsers",
    kind: "audience_breakdown",
    audienceBreakdown: "browser",
  },
  visitors: {
    label: "New / returning",
    kind: "audience_breakdown",
    audienceBreakdown: "new_vs_returning",
  },
  ecommerceItems: {
    label: "Ecommerce products",
    kind: "ecommerce_performance",
    ecommerceBreakdown: "item",
  },
  ecommerceLandingPages: {
    label: "Ecommerce landing pages",
    kind: "ecommerce_performance",
    ecommerceBreakdown: "landing_page",
    ecommerceOnlyWithTransactions: true,
  },
  siteSearch: { label: "Site search", kind: "site_search" },
  events: { label: "Events", kind: "events" },
  conversions: { label: "Key events (conversions)", kind: "key_events" },
} as const;

export function yesterdayRange(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((value) => value.type === type)?.value;
  const day = new Date(
    `${part("year")}-${part("month")}-${part("day")}T00:00:00Z`,
  );
  day.setUTCDate(day.getUTCDate() - 1);
  const date = day.toISOString().slice(0, 10);
  return { startDate: date, endDate: date };
}

export const labels: Record<string, string> = {
  totalUsers: "Users",
  activeUsers: "Active users",
  sessions: "Sessions",
  screenPageViews: "Page views",
  keyEvents: "Key events (conversions)",
  newUsers: "New users",
  engagementRate: "Engagement rate",
  bounceRate: "Bounce rate",
  averageSessionDuration: "Average session duration",
  sessionDefaultChannelGroup: "Channel",
  sessionSourceMedium: "Source / medium",
  sessionCampaignName: "Campaign",
  hostName: "Host",
  pagePath: "Page",
  landingPage: "Landing page",
  deviceCategory: "Device",
  country: "Country",
  browser: "Browser",
  newVsReturning: "Visitor type",
  eventName: "Event",
  eventCount: "Event count",
  engagedSessions: "Engaged sessions",
  sessionKeyEventRate: "Session key event rate",
  userEngagementDuration: "Total engagement duration",
  transactions: "Transactions",
  purchaseRevenue: "Purchase revenue",
  sessionManualSource: "UTM source",
  sessionManualMedium: "UTM medium",
  sessionManualCampaignName: "UTM campaign",
  sessionManualTerm: "UTM term",
  sessionManualAdContent: "UTM content",
  itemName: "Product",
  itemId: "Product ID",
  itemsViewed: "Items viewed",
  itemsAddedToCart: "Added to cart",
  itemsPurchased: "Items purchased",
  itemRevenue: "Item revenue",
  searchTerm: "Search term",
};

export function formatValue(
  key: string,
  value: string | number | null | undefined,
) {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (key.endsWith("Rate")) return `${(value * 100).toFixed(1)}%`;
  if (key.endsWith("Duration")) return `${value.toFixed(1)} s`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
