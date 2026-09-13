import { useState } from "react";
import { sort } from "remeda";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  getSearchMovers,
  inspectSearchUrls,
} from "@/serverFunctions/searchPerformance";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import type {
  SearchPerformanceDateRange,
  SearchPerformanceDevice,
} from "@/types/schemas/search-performance";

export function SearchDiagnostics({
  projectId,
  dateRange,
  device,
  country,
}: {
  projectId: string;
  dateRange: SearchPerformanceDateRange;
  device?: SearchPerformanceDevice;
  country?: string;
}) {
  const [dimension, setDimension] = useState<"query" | "page">("query");
  const [direction, setDirection] = useState<"growth" | "decline">("growth");
  const [metric, setMetric] = useState<"change" | "percentChange">("change");
  const [opened, setOpened] = useState(false);
  const [urls, setUrls] = useState("");
  const input = { projectId, dateRange, device, country, dimension };
  const movers = useQuery({
    queryKey: ["searchMovers", input],
    queryFn: () => getSearchMovers({ data: input }),
    enabled: opened,
    staleTime: 300_000,
  });
  const inspection = useMutation({
    mutationFn: (values: string[]) =>
      inspectSearchUrls({ data: { projectId, urls: values } }),
  });
  const rows = sort(
    (movers.data?.rows ?? []).filter(
      (row) =>
        row[metric] !== null &&
        (direction === "growth" ? row[metric] > 0 : row[metric] < 0),
    ),
    (a, b) =>
      (direction === "growth" ? -1 : 1) * ((a[metric] ?? 0) - (b[metric] ?? 0)),
  ).slice(0, 25);
  return (
    <div className="space-y-4">
      <section className="border border-base-300 rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-semibold">Search growth and declines</h2>
        <p className="text-sm text-base-content/70">
          Compare queries and pages with the previous equal-length period, using
          the date, device and country filters above.
        </p>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Compare queries or pages"
            className="select select-sm"
            value={dimension}
            onChange={(event) =>
              setDimension(event.target.value === "query" ? "query" : "page")
            }
          >
            <option value="query">Queries</option>
            <option value="page">Pages</option>
          </select>
          <select
            aria-label="Growth or decline"
            className="select select-sm"
            value={direction}
            onChange={(event) =>
              setDirection(
                event.target.value === "growth" ? "growth" : "decline",
              )
            }
          >
            <option value="growth">Largest growth</option>
            <option value="decline">Largest declines</option>
          </select>
          <select
            aria-label="Sort changes by"
            className="select select-sm"
            value={metric}
            onChange={(event) =>
              setMetric(
                event.target.value === "change" ? "change" : "percentChange",
              )
            }
          >
            <option value="change">Click change</option>
            <option value="percentChange">Percentage change</option>
          </select>
          <button
            className="btn btn-sm"
            onClick={() => {
              setOpened(true);
              if (opened) void movers.refetch();
            }}
            disabled={movers.isFetching}
          >
            Load comparison
          </button>
        </div>
        {opened &&
          (movers.isPending ? (
            <p role="status">Loading comparison…</p>
          ) : movers.isError ? (
            <p role="alert">{getStandardErrorMessage(movers.error)}</p>
          ) : movers.data ? (
            <>
              <p className="text-sm">
                {movers.data.range.startDate} – {movers.data.range.endDate},
                compared with {movers.data.previous.startDate} –{" "}
                {movers.data.previous.endDate}.
              </p>
              <p className="text-xs text-base-content/70">
                Google may omit anonymized queries and other rows. Missing rows
                mean no reported clicks, not proof of no searches.
                {movers.data.capped
                  ? " At least one period reached the 1,000-row limit. Rankings cover returned rows only; missing counterparts are excluded."
                  : ""}
              </p>
              {!rows.length ? (
                <p>
                  No comparable{" "}
                  {direction === "growth" ? "increases" : "declines"} found.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>{dimension === "query" ? "Query" : "Page"}</th>
                        <th>Clicks</th>
                        <th>Previous clicks</th>
                        <th>Change</th>
                        <th>Change %</th>
                        <th>Impressions</th>
                        <th>CTR</th>
                        <th>Position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.key}>
                          <td className="max-w-96 break-words">{row.key}</td>
                          <td>{row.clicks ?? "—"}</td>
                          <td>{row.previousClicks ?? "—"}</td>
                          <td>{row.change}</td>
                          <td>
                            {row.percentChange === null
                              ? "—"
                              : `${(row.percentChange * 100).toFixed(1)}%`}
                          </td>
                          <td>{row.impressions ?? "—"}</td>
                          <td>
                            {row.ctr === null
                              ? "—"
                              : `${(row.ctr * 100).toFixed(1)}%`}
                          </td>
                          <td>{row.position?.toFixed(1) ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null)}
      </section>
      <section className="border border-base-300 rounded-xl p-4 space-y-3">
        <h2 className="text-lg font-semibold">Google index inspection</h2>
        <p className="text-sm text-base-content/70">
          Check up to 10 URLs from the connected property. Results describe
          Google’s last indexed version, not a live crawl or a complete
          inventory of unindexed pages.
        </p>
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            inspection.mutate(urls.split(/\s+/).filter(Boolean));
          }}
        >
          <label className="block">
            URLs, one per line
            <textarea
              className="textarea textarea-bordered w-full block"
              rows={3}
              required
              value={urls}
              onChange={(event) => setUrls(event.target.value)}
            />
          </label>
          <button
            className="btn btn-sm btn-primary"
            disabled={inspection.isPending}
          >
            Inspect URLs
          </button>
        </form>
        {inspection.isPending && <p role="status">Inspecting URLs…</p>}
        {inspection.isError && (
          <p role="alert">{getStandardErrorMessage(inspection.error)}</p>
        )}
        {inspection.data?.results.map((row) => (
          <div
            className="border-t border-base-300 pt-3 text-sm space-y-1"
            key={row.url}
          >
            <p className="font-medium break-all">{row.url}</p>
            {row.error ? (
              <p role="alert">{row.error}</p>
            ) : (
              <>
                <p>
                  {row.result?.indexStatusResult?.verdict ?? "Unknown"} ·{" "}
                  {row.result?.indexStatusResult?.coverageState ??
                    "No coverage information"}
                </p>
                <p>
                  Indexing:{" "}
                  {row.result?.indexStatusResult?.indexingState ?? "Unknown"} ·
                  Robots:{" "}
                  {row.result?.indexStatusResult?.robotsTxtState ?? "Unknown"}
                </p>
                <p>
                  Last crawled:{" "}
                  {row.result?.indexStatusResult?.lastCrawlTime ?? "Unknown"}
                </p>
                <p className="break-all">
                  Google canonical:{" "}
                  {row.result?.indexStatusResult?.googleCanonical ?? "Unknown"}
                </p>
                <p className="break-all">
                  Declared canonical:{" "}
                  {row.result?.indexStatusResult?.userCanonical ?? "Unknown"}
                </p>
                <p className="break-all">
                  Sitemaps:{" "}
                  {row.result?.indexStatusResult?.sitemap?.join(", ") ||
                    "None reported"}
                </p>
              </>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
