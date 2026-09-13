import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getAnalyticsPortfolio } from "@/serverFunctions/analytics";
import { getStandardErrorMessage } from "@/client/lib/error-messages";

const labels = {
  totalUsers: "Users summed across properties",
  sessions: "Sessions",
  screenPageViews: "Page views",
  keyEvents: "Key events (conversions)",
};

export function AnalyticsPortfolio() {
  const [enabled, setEnabled] = useState(false);
  const [draft, setDraft] = useState({ startDate: "", endDate: "" });
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>(
    {},
  );
  const [comparison, setComparison] = useState<
    "previous_period" | "previous_week"
  >("previous_period");
  const query = useQuery({
    queryKey: ["analyticsPortfolio", range, comparison],
    queryFn: () => getAnalyticsPortfolio({ data: { ...range, comparison } }),
    enabled,
    staleTime: 300_000,
    retry: false,
  });
  return (
    <section className="space-y-3 border border-base-300 rounded-xl p-4">
      <h2 className="text-lg font-semibold">All-site traffic overview</h2>
      <p className="text-sm text-base-content/70">
        All channels, last 28 complete days by default. Shared GA4 properties
        are counted once. Users across different properties are not
        deduplicated; each property uses its own time zone.
      </p>
      <form
        className="flex flex-wrap gap-2 items-end"
        onSubmit={(event) => {
          event.preventDefault();
          setRange(draft);
          setEnabled(true);
        }}
      >
        <label>
          From
          <input
            className="input input-sm block"
            type="date"
            required
            value={draft.startDate}
            max={draft.endDate || undefined}
            onChange={(event) =>
              setDraft({ ...draft, startDate: event.target.value })
            }
          />
        </label>
        <label>
          To
          <input
            className="input input-sm block"
            type="date"
            required
            value={draft.endDate}
            min={draft.startDate || undefined}
            onChange={(event) =>
              setDraft({ ...draft, endDate: event.target.value })
            }
          />
        </label>
        <button className="btn btn-sm" type="submit">
          Apply dates
        </button>
        <select
          className="select select-sm"
          aria-label="All-site comparison period"
          value={comparison}
          onChange={(event) =>
            setComparison(
              event.target.value === "previous_week"
                ? "previous_week"
                : "previous_period",
            )
          }
        >
          <option value="previous_period">Previous equal-length period</option>
          <option value="previous_week">Same dates shifted back 7 days</option>
        </select>
        <button
          className="btn btn-sm"
          type="button"
          disabled={query.isFetching}
          onClick={() => {
            setEnabled(true);
            if (enabled) void query.refetch();
          }}
        >
          Load / refresh
        </button>
      </form>
      {enabled &&
        (query.isPending ? (
          <p role="status">Loading properties…</p>
        ) : query.isError ? (
          <p role="alert">{getStandardErrorMessage(query.error)}</p>
        ) : query.data ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              {query.data.totals.map((total) => (
                <div
                  key={total.metric}
                  className="border border-base-300 rounded p-3"
                >
                  <p className="text-sm">{labels[total.metric]}</p>
                  <p className="text-xl">
                    {total.current.value?.toLocaleString() ?? "—"}
                  </p>
                  <p className="text-xs">
                    Previous: {total.previous.value?.toLocaleString() ?? "—"}
                  </p>
                  <p className="text-xs">
                    Current / previous coverage: {total.current.properties} /{" "}
                    {total.previous.properties} properties
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs">
              Totals include available metrics only. Check coverage and per-site
              statuses before comparing periods.
            </p>
            {query.data.rows.map((row) => (
              <div
                key={row.projectId}
                className="border-t border-base-300 py-2 text-sm space-y-1"
              >
                <Link
                  className="link"
                  to="/p/$projectId/analytics"
                  params={{ projectId: row.projectId }}
                >
                  {row.name}
                </Link>
                <p>
                  {row.status}
                  {row.range
                    ? ` · ${row.range.startDate} – ${row.range.endDate} · ${row.timeZone}`
                    : ""}
                </p>
                {row.current && (
                  <p>
                    Users: {row.current.totalUsers ?? "—"} · Sessions:{" "}
                    {row.current.sessions ?? "—"} · Views:{" "}
                    {row.current.screenPageViews ?? "—"} · Key events:{" "}
                    {row.current.keyEvents ?? "—"}
                  </p>
                )}
                {row.alerts.map((alert) => (
                  <p className="alert alert-warning" key={alert}>
                    {alert}
                  </p>
                ))}
              </div>
            ))}
          </>
        ) : null)}
    </section>
  );
}
