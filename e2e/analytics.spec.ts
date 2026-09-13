import { expect, test } from "@playwright/test";

test("traffic reports, comparisons, pagination and index inspection", async ({
  page,
}) => {
  await page.route("**/src/serverFunctions/ga4.ts*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `
    export const getGa4Connection = async () => ({ connected: true, propertyTimeZone: 'UTC' });
    export const disconnectGa4 = async () => {};
    export const listGa4Properties = async () => {};
    export const setGa4Property = async () => {};
    export const startSelfHostedGa4Link = async () => {};
    export const getGa4DashboardReport = async () => {};
  `,
    }),
  );
  await page.route("**/src/serverFunctions/analytics.ts*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `
    export const getAnalyticsOverview = async ({data}) => ({
      current: {totalUsers: 120},
      comparison: { totalUsers: {current: 120, previous: 100, percentChange: .2}, sessions: {current: 160, previous: 100, percentChange: .6} },
      request: { resolvedDateRange: {startDate: data.startDate || '2026-08-14', endDate: data.endDate || '2026-09-10'}, previousDateRange: {startDate: data.comparison === 'previous_week' ? '2026-08-07' : '2026-07-17', endDate: '2026-08-13'}, propertyTimeZone: 'UTC' },
      reportMetadata: {hasLimitedData: false}, warnings: [], diagnostics: [], trafficAlerts: [{code:'sessions_large_change',message:'Sessions rose by 60%.'}]
    });
    export const getAnalyticsReport = async ({data}) => {
      if (data.audienceBreakdown === 'country') return {error:{code:'ga4_quota_exhausted',message:'Reporting quota exhausted. Try again later.'}};
      const dimension = data.audienceBreakdown === 'browser' ? 'browser' : data.kind === 'events' ? 'eventName' : data.acquisitionBreakdown === 'utm' ? 'sessionManualAdContent' : 'sessionDefaultChannelGroup';
      return {request: {dimensions:[dimension],metrics:['sessions'],currencyCode:'GBP'},rows:[{[dimension]: data.offset ? 'Second page' : data.channel === 'organic_search' ? 'Organic only' : 'First page',sessions:160}],totalRowCount:26,pageInfo:{hasMore:!data.offset},reportMetadata:{hasLimitedData:false},warnings:[]};
    };
    export const getAnalyticsPortfolio = async () => ({});
  `,
    }),
  );
  await page.route("**/src/serverFunctions/searchPerformance.ts*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `
    export const getSearchMovers = async ({data}) => ({range:{startDate:'2026-08-14',endDate:'2026-09-10'},previous:{startDate:'2026-07-17',endDate:'2026-08-13'},capped:true,rows:[{key:data.dimension === 'page' ? '/growing-page' : 'growing query',clicks:20,previousClicks:10,change:10,percentChange:1,impressions:100,ctr:.2,position:5},{key:'declining query',clicks:5,previousClicks:10,change:-5,percentChange:-.5,impressions:100,ctr:.05,position:12}]});
    export const inspectSearchUrls = async ({data}) => ({results:data.urls.map(url=>({url,result:{indexStatusResult:{verdict:'NEUTRAL',coverageState:'Crawled - currently not indexed',indexingState:'INDEXING_ALLOWED'}}}))});
  `,
    }),
  );
  await page.goto("/e2e/fixtures/analytics-preview.html");
  await expect(
    page.getByRole("heading", { name: "Traffic analytics", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Sessions rose by 60%.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Browsers", exact: true }).click();
  await expect(
    page.getByRole("columnheader", { name: "Browser", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "Second page", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "UTM parameters", exact: true })
    .click();
  await expect(
    page.getByRole("columnheader", { name: "UTM content", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Page 1", { exact: true })).toBeVisible();
  await page
    .getByLabel("Traffic", { exact: true })
    .selectOption("organic_search");
  await expect(
    page.getByRole("cell", { name: "Organic only", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Countries", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Reporting quota exhausted" }),
  ).toBeVisible();
  await page
    .getByLabel("Compare with", { exact: true })
    .selectOption("previous_week");
  await expect(page.getByText(/Compared with 2026-08-07/)).toBeVisible();
  await page
    .getByRole("button", { name: "Load comparison", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "growing query", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/1,000-row limit/)).toBeVisible();
  await page.getByLabel("Growth or decline").selectOption("decline");
  await expect(
    page.getByRole("cell", { name: "declining query", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Growth or decline").selectOption("growth");
  await page.getByLabel("Compare queries or pages").selectOption("page");
  await expect(
    page.getByRole("cell", { name: "/growing-page", exact: true }),
  ).toBeVisible();
  await page.getByLabel("URLs, one per line").fill("https://example.com/a");
  await page.getByRole("button", { name: "Inspect URLs", exact: true }).click();
  await expect(page.getByText(/Crawled - currently not indexed/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Traffic analytics", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});
