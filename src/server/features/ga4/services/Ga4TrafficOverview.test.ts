import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeGa4Connection } from "./ga4-test-fixtures";
import { Ga4OrganicOverviewService } from "./Ga4OrganicOverviewService";
import { buildGa4ReportRequest } from "./Ga4ReportDefinitions";
import type {
  Ga4RunReportRequest,
  Ga4RunReportResponse,
} from "@/server/lib/ga4Client";

const mocks = vi.hoisted(() => ({
  getByProjectId: vi.fn(),
  runReport:
    vi.fn<(request: Ga4RunReportRequest) => Promise<Ga4RunReportResponse>>(),
}));
vi.mock("@/server/features/ga4/repositories/Ga4ConnectionRepository", () => ({
  Ga4ConnectionRepository: { getByProjectId: mocks.getByProjectId },
}));
vi.mock("@/server/lib/ga4Client", () => ({
  createGa4DataClient: () => ({ runReport: mocks.runReport }),
}));

describe("traffic analytics", () => {
  beforeEach(() => {
    mocks.getByProjectId.mockResolvedValue(makeGa4Connection());
    mocks.runReport.mockImplementation(
      async (request: Ga4RunReportRequest) => ({
        dimensionHeaders: request.dimensions,
        metricHeaders: request.metrics,
        rows: [
          {
            dimensionValues: request.dimensions.map(() => ({
              value: "20260910",
            })),
            metricValues: request.metrics.map(({ name }) => ({
              value: name === "bounceRate" ? "0.25" : "10",
            })),
          },
        ],
        rowCount: 1,
      }),
    );
  });

  it("queries distinct property users and page views without summing dimension rows", async () => {
    const result = await Ga4OrganicOverviewService.getTrafficOverview(
      {
        projectId: "project_1",
        startDate: "2026-09-10",
        endDate: "2026-09-10",
      },
      { now: new Date("2026-09-12T12:00:00Z") },
    );
    expect(result.current).toMatchObject({
      totalUsers: 10,
      screenPageViews: 10,
      bounceRate: 0.25,
    });
    expect(result.request.previousDateRange).toEqual({
      startDate: "2026-09-09",
      endDate: "2026-09-09",
    });
    expect(mocks.runReport.mock.calls[0][0]).toMatchObject({
      dimensions: [],
      dimensionFilter: undefined,
    });
    expect(mocks.runReport.mock.calls[0][0].metrics.length).toBeLessThanOrEqual(
      10,
    );
  });

  it("applies the same organic filter to both periods and the trend", async () => {
    await Ga4OrganicOverviewService.getTrafficOverview({
      projectId: "project_1",
      channel: "organic_search",
    });
    expect(mocks.runReport).toHaveBeenCalledTimes(3);
    for (const [request] of mocks.runReport.mock.calls) {
      expect(request.dimensionFilter).toMatchObject({
        filter: { stringFilter: { value: "Organic Search" } },
      });
    }
  });

  it("retains empty reports without manufacturing zero users", async () => {
    mocks.runReport.mockResolvedValue({});
    const result = await Ga4OrganicOverviewService.getTrafficOverview({
      projectId: "project_1",
    });
    expect(result.current).toBeNull();
    expect(result.comparison.totalUsers.current).toBeNull();
  });

  it("compares yesterday with the same weekday when requested", async () => {
    const result = await Ga4OrganicOverviewService.getTrafficOverview({
      projectId: "project_1",
      startDate: "2026-09-10",
      endDate: "2026-09-10",
      comparison: "previous_week",
    });
    expect(result.request.previousDateRange).toEqual({
      startDate: "2026-09-03",
      endDate: "2026-09-03",
    });
  });

  it("distinguishes ordinary events, manual attribution and browser reports", () => {
    const base = {
      startDate: "2026-09-01",
      endDate: "2026-09-10",
      channel: "all" as const,
      limit: 25,
      offset: 0,
    };
    const events = buildGa4ReportRequest({ ...base, kind: "events" });
    expect(events.metricFilter).toBeUndefined();
    expect(events.metrics).toContainEqual({ name: "eventCount" });
    const utm = buildGa4ReportRequest({
      ...base,
      kind: "traffic_acquisition",
      acquisitionBreakdown: "utm",
    });
    expect(utm.dimensions).toEqual(
      [
        "sessionManualSource",
        "sessionManualMedium",
        "sessionManualCampaignName",
        "sessionManualTerm",
        "sessionManualAdContent",
      ].map((name) => ({ name })),
    );
    const browser = buildGa4ReportRequest({
      ...base,
      kind: "audience_breakdown",
      audienceBreakdown: "browser",
    });
    expect(browser.dimensions).toEqual([{ name: "browser" }]);
  });
});
