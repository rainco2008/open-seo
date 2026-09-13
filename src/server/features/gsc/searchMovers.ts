import type { GscSearchAnalyticsRow } from "@/server/lib/gscClient";

/** Missing rows in a capped response are unknown, not zero traffic. */
export function buildSearchMovers(
  currentRows: GscSearchAnalyticsRow[],
  previousRows: GscSearchAnalyticsRow[],
  limit: number,
) {
  const current = new Map(
    currentRows.flatMap((row) =>
      row.keys?.[0] ? [[row.keys[0], row] as const] : [],
    ),
  );
  const previous = new Map(
    previousRows.flatMap((row) =>
      row.keys?.[0] ? [[row.keys[0], row] as const] : [],
    ),
  );
  const currentCapped = currentRows.length >= limit;
  const previousCapped = previousRows.length >= limit;
  const rows = [...new Set([...current.keys(), ...previous.keys()])].map(
    (key) => {
      const now = current.get(key);
      const before = previous.get(key);
      const clicks = now?.clicks ?? (currentCapped ? null : 0);
      const previousClicks = before?.clicks ?? (previousCapped ? null : 0);
      const change =
        clicks !== null && previousClicks !== null
          ? clicks - previousClicks
          : null;
      return {
        key,
        clicks,
        previousClicks,
        change,
        percentChange:
          change !== null && previousClicks !== null && previousClicks > 0
            ? change / previousClicks
            : null,
        impressions: now?.impressions ?? null,
        ctr: now?.ctr ?? null,
        position: now?.position ?? null,
      };
    },
  );
  return {
    rows,
    capped: currentCapped || previousCapped,
    currentRows: currentRows.length,
    previousRows: previousRows.length,
  };
}
