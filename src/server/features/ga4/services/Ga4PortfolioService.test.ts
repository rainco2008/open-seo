import { beforeEach, describe, expect, it, vi } from "vitest";
import { Ga4PortfolioService } from "./Ga4PortfolioService";
import { Ga4ReportError } from "@/server/lib/ga4Errors";

const mocks = vi.hoisted(() => ({
  listProjects: vi.fn(),
  getByProjectId: vi.fn(),
  getTrafficOverview: vi.fn(),
}));
vi.mock("@/server/features/projects/services/ProjectService", () => ({
  ProjectService: { listProjects: mocks.listProjects },
}));
vi.mock("@/server/features/ga4/repositories/Ga4ConnectionRepository", () => ({
  Ga4ConnectionRepository: { getByProjectId: mocks.getByProjectId },
}));
vi.mock("./Ga4OrganicOverviewService", () => ({
  Ga4OrganicOverviewService: { getTrafficOverview: mocks.getTrafficOverview },
}));

describe("portfolio analytics", () => {
  beforeEach(() => {
    mocks.listProjects.mockResolvedValue([
      { id: "a", name: "Site A" },
      { id: "b", name: "Site B" },
    ]);
    mocks.getByProjectId.mockResolvedValue({
      propertyId: "properties/1",
      propertyTimeZone: "UTC",
    });
    mocks.getTrafficOverview.mockResolvedValue({
      current: {
        totalUsers: 10,
        sessions: 12,
        screenPageViews: 20,
        keyEvents: 2,
      },
      previous: {
        totalUsers: 5,
        sessions: 6,
        screenPageViews: 10,
        keyEvents: 1,
      },
      reportMetadata: { hasLimitedData: false },
      request: {
        resolvedDateRange: { startDate: "2026-09-01", endDate: "2026-09-10" },
      },
      trafficAlerts: [],
      diagnostics: [],
    });
  });
  it("scopes projects to the authenticated organization and counts shared properties once", async () => {
    const result = await Ga4PortfolioService.getPortfolio("org-a", {
      comparison: "previous_period",
    });
    expect(mocks.listProjects).toHaveBeenCalledWith("org-a");
    expect(mocks.getTrafficOverview).toHaveBeenCalledTimes(1);
    expect(
      result.totals.find((total) => total.metric === "totalUsers")?.current,
    ).toEqual({ value: 10, properties: 1 });
    expect(result.rows[1].status).toContain("counted once");
  });
  it("keeps failed properties visible and excludes unavailable values from coverage", async () => {
    mocks.getByProjectId.mockImplementation(async (id: string) => ({
      propertyId: `properties/${id}`,
      propertyTimeZone: "UTC",
    }));
    mocks.getTrafficOverview.mockRejectedValueOnce(
      new Ga4ReportError("ga4_quota_exhausted", "Quota exhausted"),
    );
    const result = await Ga4PortfolioService.getPortfolio("org-a", {
      comparison: "previous_period",
    });
    expect(result.rows[0].status).toBe("Quota exhausted");
    expect(result.totals[0].current).toEqual({ value: 10, properties: 1 });
  });
  it("does not present an entirely disconnected portfolio as zero traffic", async () => {
    mocks.getByProjectId.mockResolvedValue(null);
    const result = await Ga4PortfolioService.getPortfolio("org-a", {
      comparison: "previous_period",
    });
    expect(result.totals.every((total) => total.current.value === null)).toBe(
      true,
    );
    expect(mocks.getTrafficOverview).not.toHaveBeenCalled();
  });
});
