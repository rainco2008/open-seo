import { describe, expect, it } from "vitest";
import { buildSearchMovers } from "./searchMovers";

const row = (key: string, clicks: number) => ({
  keys: [key],
  clicks,
  impressions: 100,
  ctr: clicks / 100,
  position: 5,
});
describe("search movers", () => {
  it("compares both periods including newly reported and disappearing rows", () => {
    const result = buildSearchMovers(
      [row("growing", 20), row("new", 5)],
      [row("growing", 10), row("lost", 8)],
      1000,
    );
    expect(result.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "growing",
          change: 10,
          percentChange: 1,
        }),
        expect.objectContaining({ key: "new", change: 5, percentChange: null }),
        expect.objectContaining({ key: "lost", change: -8, percentChange: -1 }),
      ]),
    );
  });
  it("does not invent declines or growth for missing rows in capped reports", () => {
    const result = buildSearchMovers([row("new", 5)], [row("old", 10)], 1);
    expect(result.capped).toBe(true);
    expect(result.rows.every((value) => value.change === null)).toBe(true);
  });
});
