import { useState } from "react";
import { entries } from "remeda";
import { useQuery } from "@tanstack/react-query";
import { getGa4Connection } from "@/serverFunctions/ga4";
import {
  getAnalyticsOverview,
  getAnalyticsReport,
} from "@/serverFunctions/analytics";
import { GoogleAnalyticsConnectionCard } from "./GoogleAnalyticsConnectionCard";
import { getStandardErrorMessage } from "@/client/lib/error-messages";

import {
  reports,
  labels,
  formatValue,
  yesterdayRange,
} from "./analyticsDisplay";

export function AnalyticsPage({ projectId }: { projectId: string }) {
  const [channel, setChannel] = useState<"all" | "organic_search">("all");
  const [tab, setTab] = useState<keyof typeof reports>("channels");
  const [offset, setOffset] = useState(0);
  const [comparison, setComparison] = useState<
    "previous_period" | "previous_week"
  >("previous_period");
  const [dates, setDates] = useState({ startDate: "", endDate: "" });
  const [range, setRange] = useState<{ startDate?: string; endDate?: string }>(
    {},
  );
  const connection = useQuery({
    queryKey: ["ga4Connection", projectId],
    queryFn: () => getGa4Connection({ data: { projectId } }),
  });
  const input = { projectId, channel, ...range };
  const overview = useQuery({
    queryKey: ["analyticsOverview", input, comparison],
    queryFn: async () => {
      const result = await getAnalyticsOverview({
        data: { ...input, comparison },
      });
      if ("error" in result) throw new Error(result.error.message);
      return result;
    },
    enabled: connection.data?.connected === true,
    staleTime: 300_000,
  });
  const report = useQuery({
    queryKey: ["analyticsReport", input, tab, offset],
    queryFn: async () => {
      const result = await getAnalyticsReport({
        data: { ...input, ...reports[tab], offset, limit: 25 },
      });
      if ("error" in result) throw new Error(result.error.message);
      return result;
    },
    enabled: connection.data?.connected === true,
    staleTime: 300_000,
  });
  const data = overview.data;
  const columns = report.data
    ? [...report.data.request.dimensions, ...report.data.request.metrics]
    : [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Traffic analytics</h1>
        <p className="text-sm text-base-content/70">
          Google Analytics traffic, acquisition, audience and outcomes.
        </p>
      </div>
      {connection.isPending ? (
        <p role="status">Loading connection…</p>
      ) : connection.isError ? (
        <p role="alert">{getStandardErrorMessage(connection.error)}</p>
      ) : !connection.data?.connected ? (
        <GoogleAnalyticsConnectionCard projectId={projectId} />
      ) : (
        <>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              setRange(dates);
              setOffset(0);
            }}
          >
            <label className="space-y-1">
              Traffic
              <select
                className="select select-bordered block"
                value={channel}
                onChange={(event) => {
                  setChannel(
                    event.target.value === "all" ? "all" : "organic_search",
                  );
                  setOffset(0);
                }}
              >
                <option value="all">All channels</option>
                <option value="organic_search">Organic search</option>
              </select>
            </label>
            <label className="space-y-1">
              From
              <input
                className="input input-bordered block"
                type="date"
                required
                value={dates.startDate}
                max={dates.endDate || undefined}
                onChange={(event) =>
                  setDates({ ...dates, startDate: event.target.value })
                }
              />
            </label>
            <label className="space-y-1">
              To
              <input
                className="input input-bordered block"
                type="date"
                required
                value={dates.endDate}
                min={dates.startDate || undefined}
                onChange={(event) =>
                  setDates({ ...dates, endDate: event.target.value })
                }
              />
            </label>
            <button className="btn btn-primary" type="submit">
              Apply dates
            </button>
            <label className="space-y-1">
              Compare with
              <select
                className="select select-bordered block"
                value={comparison}
                onChange={(event) =>
                  setComparison(
                    event.target.value === "previous_week"
                      ? "previous_week"
                      : "previous_period",
                  )
                }
              >
                <option value="previous_period">
                  Previous equal-length period
                </option>
                <option value="previous_week">
                  Same dates shifted back 7 days
                </option>
              </select>
            </label>
            <button
              className="btn"
              type="button"
              onClick={() => {
                const nextRange = yesterdayRange(
                  connection.data?.propertyTimeZone ?? "UTC",
                );
                setDates(nextRange);
                setRange(nextRange);
                setOffset(0);
              }}
            >
              Yesterday
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => {
                setDates({ startDate: "", endDate: "" });
                setRange({});
                setOffset(0);
              }}
            >
              Last 28 complete days
            </button>
          </form>
          {overview.isPending ? (
            <p role="status">Loading overview…</p>
          ) : overview.isError ? (
            <p className="alert alert-error" role="alert">
              {getStandardErrorMessage(overview.error)}
            </p>
          ) : data ? (
            <>
              <p className="text-sm">
                {data.request.resolvedDateRange.startDate} –{" "}
                {data.request.resolvedDateRange.endDate} ·{" "}
                {data.request.propertyTimeZone} · Compared with{" "}
                {data.request.previousDateRange.startDate} –{" "}
                {data.request.previousDateRange.endDate}
              </p>
              {data.reportMetadata.hasLimitedData && (
                <p className="alert alert-warning">
                  Google marked this data as limited. Sampling, privacy
                  thresholds or restricted metrics may affect the results.
                </p>
              )}
              {data.warnings.includes("end_date_clamped") && (
                <p className="alert">
                  The end date was adjusted to the last complete Analytics day.
                </p>
              )}
              {!data.current ? (
                <p>No traffic recorded for this period and channel.</p>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {Object.entries(data.comparison).map(([key, value]) => (
                    <div
                      key={key}
                      className="border border-base-300 rounded-lg p-4"
                    >
                      <p className="text-sm text-base-content/70">
                        {labels[key] ?? key}
                      </p>
                      <p className="text-xl font-semibold">
                        {formatValue(key, value.current)}
                      </p>
                      <p className="text-xs">
                        Previous: {formatValue(key, value.previous)}
                        {value.percentChange === null
                          ? ""
                          : ` · ${value.percentChange > 0 ? "+" : ""}${(value.percentChange * 100).toFixed(1)}%`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {data.diagnostics.map((finding) => (
                <p key={finding.code} className="alert alert-warning">
                  {finding.message}
                </p>
              ))}
              {data.trafficAlerts.map((finding) => (
                <p key={finding.code} className="alert alert-warning">
                  {finding.message}
                </p>
              ))}
            </>
          ) : null}
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Analytics reports"
          >
            {entries(reports).map(([key, value]) => (
              <button
                className={`btn btn-sm ${tab === key ? "btn-primary" : "btn-ghost"}`}
                key={key}
                aria-pressed={tab === key}
                onClick={() => {
                  setTab(key);
                  setOffset(0);
                }}
              >
                {value.label}
              </button>
            ))}
          </div>
          {report.isPending ? (
            <p role="status">Loading report…</p>
          ) : report.isError ? (
            <p className="alert alert-error" role="alert">
              {getStandardErrorMessage(report.error)}
            </p>
          ) : report.data ? (
            <>
              <p className="text-sm">
                {reports[tab].label} ·{" "}
                {report.data.totalRowCount.toLocaleString()} rows · Revenue in{" "}
                {report.data.request.currencyCode}. Users are distinct within
                each row; row totals are not additive.
              </p>
              {report.data.reportMetadata.hasLimitedData && (
                <p className="alert alert-warning">
                  Google marked this report as limited; these rows may not
                  represent all traffic.
                </p>
              )}
              {report.data.rows.length === 0 ? (
                <p>No data recorded for this report.</p>
              ) : (
                <div className="overflow-x-auto border border-base-300 rounded-lg">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        {columns.map((key) => (
                          <th key={key}>{labels[key] ?? key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.data.rows.map((row, index) => (
                        <tr key={offset + index}>
                          {columns.map((key) => (
                            <td key={key} className="max-w-80 break-words">
                              {formatValue(key, row[key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex gap-3 items-center">
                <button
                  className="btn btn-sm"
                  disabled={offset === 0 || report.isFetching}
                  onClick={() => setOffset(Math.max(0, offset - 25))}
                >
                  Previous
                </button>
                <span>Page {Math.floor(offset / 25) + 1}</span>
                <button
                  className="btn btn-sm"
                  disabled={!report.data.pageInfo.hasMore || report.isFetching}
                  onClick={() => setOffset(offset + 25)}
                >
                  Next
                </button>
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
