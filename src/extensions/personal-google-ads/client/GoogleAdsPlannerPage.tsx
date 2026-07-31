import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { buildCsv, downloadCsv } from "@/client/lib/csv";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { saveKeywords } from "@/serverFunctions/keywords";
import {
  generatePersonalGoogleAdsKeywordIdeas,
  getPersonalGoogleAdsHistoricalMetrics,
  getPersonalGoogleAdsPlannerStatus,
} from "../server-functions";
import type { PersonalGoogleAdsKeywordRow } from "../types";

type PlannerMode = "ideas" | "metrics";

function parseKeywordLines(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    ),
  );
}

function formatNumber(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat().format(value);
}

function formatMoney(value: number | null, currencyCode: string) {
  if (value === null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(value);
}

function downloadPlannerRows(
  mode: PlannerMode,
  rows: PersonalGoogleAdsKeywordRow[],
) {
  downloadCsv(
    `google-ads-${mode}.csv`,
    buildCsv(
      [
        "Keyword",
        "Avg monthly searches",
        "Competition",
        "Competition index",
        "Average CPC",
        "Low top-of-page bid",
        "High top-of-page bid",
        "Currency",
      ],
      rows.map((row) => [
        row.keyword,
        row.searchVolume,
        row.competitionLevel,
        row.competition,
        row.averageCpc,
        row.lowTopOfPageBid,
        row.highTopOfPageBid,
        row.currencyCode,
      ]),
    ),
  );
}

export function GoogleAdsPlannerPage({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<PlannerMode>("ideas");
  const [keywordInput, setKeywordInput] = useState("");
  const [url, setUrl] = useState("");
  const [rows, setRows] = useState<PersonalGoogleAdsKeywordRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const statusQuery = useQuery({
    queryKey: ["personal-google-ads-status", projectId],
    queryFn: () => getPersonalGoogleAdsPlannerStatus({ data: { projectId } }),
    retry: false,
    staleTime: 60_000,
  });

  const plannerMutation = useMutation({
    mutationFn: async () => {
      const keywords = parseKeywordLines(keywordInput);
      if (mode === "ideas") {
        return generatePersonalGoogleAdsKeywordIdeas({
          data: {
            projectId,
            keywords,
            url: url.trim() || undefined,
            pageSize: 100,
          },
        });
      }
      return getPersonalGoogleAdsHistoricalMetrics({
        data: { projectId, keywords },
      });
    },
    onSuccess: (result) => {
      setRows(result.rows);
      setSelected(new Set());
    },
    onError: (error) =>
      toast.error(getStandardErrorMessage(error, "Google Ads request failed")),
  });

  const saveMutation = useMutation({
    mutationFn: (selectedRows: PersonalGoogleAdsKeywordRow[]) =>
      saveKeywords({
        data: {
          projectId,
          keywords: selectedRows.map((row) => row.keyword),
          tags: ["source:google-ads"],
        },
      }),
    onSuccess: (_result, savedRows) => {
      void queryClient.invalidateQueries({
        queryKey: ["savedKeywords", projectId],
      });
      toast.success(`Saved ${savedRows.length} keywords`);
      setSelected(new Set());
    },
    onError: (error) =>
      toast.error(getStandardErrorMessage(error, "Could not save keywords")),
  });

  const selectedRows = useMemo(
    () => rows.filter((row) => selected.has(row.keyword)),
    [rows, selected],
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const keywords = parseKeywordLines(keywordInput);
    if (mode === "metrics" && keywords.length === 0) {
      toast.error("Enter at least one keyword");
      return;
    }
    if (mode === "ideas" && keywords.length === 0 && !url.trim()) {
      toast.error("Enter a keyword or HTTPS URL");
      return;
    }
    plannerMutation.mutate();
  };

  const status = statusQuery.data;
  const ready = status?.ready === true;
  const allSelected = rows.length > 0 && selected.size === rows.length;

  return (
    <div className="px-4 py-4 pb-24 overflow-auto md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Google Ads Keyword Planner</h1>
          <p className="text-sm text-base-content/70">
            Personal extension for Google keyword ideas and historical metrics.
          </p>
        </div>

        {statusQuery.isPending ? (
          <div className="alert">
            <Loader2 className="size-4 animate-spin" /> Checking configuration…
          </div>
        ) : statusQuery.isError ? (
          <div className="alert alert-error">
            {getStandardErrorMessage(
              statusQuery.error,
              "Could not check Google Ads configuration",
            )}
          </div>
        ) : !ready ? (
          <div className="alert alert-warning">
            <div>
              <div className="font-medium">Configuration required</div>
              <div className="text-sm">{status?.message}</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-lg border border-base-300 bg-base-100 px-4 py-3 text-sm">
            <span>
              <span className="text-base-content/60">Customer:</span>{" "}
              {status.customerId}
            </span>
            <span>
              <span className="text-base-content/60">Market:</span>{" "}
              {status.market.languageCode} / {status.market.locationCode}
            </span>
            <span>
              <span className="text-base-content/60">Currency:</span>{" "}
              {status.currencyCode}
            </span>
            <span>
              <span className="text-base-content/60">API:</span>{" "}
              {status.apiVersion}
            </span>
          </div>
        )}

        <form
          onSubmit={submit}
          className="rounded-xl border border-base-300 bg-base-100 p-4 space-y-4"
        >
          <div role="tablist" className="tabs tabs-border w-fit">
            <button
              type="button"
              role="tab"
              className={`tab ${mode === "ideas" ? "tab-active" : ""}`}
              onClick={() => setMode("ideas")}
            >
              Keyword ideas
            </button>
            <button
              type="button"
              role="tab"
              className={`tab ${mode === "metrics" ? "tab-active" : ""}`}
              onClick={() => setMode("metrics")}
            >
              Historical metrics
            </button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="form-control">
              <span className="label-text mb-1 text-sm font-medium">
                Keywords
              </span>
              <textarea
                className="textarea textarea-bordered min-h-32 w-full"
                value={keywordInput}
                onChange={(event) => setKeywordInput(event.target.value)}
                placeholder={
                  mode === "ideas"
                    ? "Up to 10 keywords, one per line"
                    : "One keyword per line"
                }
              />
            </label>
            <label
              className={`form-control ${mode === "metrics" ? "opacity-50" : ""}`}
            >
              <span className="label-text mb-1 text-sm font-medium">
                Landing page URL (optional)
              </span>
              <input
                className="input input-bordered w-full"
                type="url"
                inputMode="url"
                value={url}
                disabled={mode === "metrics"}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/page"
              />
              <span className="mt-2 text-xs text-base-content/60">
                The project market is used automatically.
              </span>
            </label>
          </div>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={!ready || plannerMutation.isPending}
          >
            {plannerMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Search className="size-4" />
            )}
            {mode === "ideas" ? "Find ideas" : "Get metrics"}
          </button>
        </form>

        {rows.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-base-300 bg-base-100">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 px-4 py-3">
              <span className="text-sm text-base-content/70">
                {rows.length} results · {selected.size} selected
              </span>
              <div className="flex gap-2">
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  onClick={() => downloadPlannerRows(mode, rows)}
                >
                  <Download className="size-4" /> Export CSV
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  disabled={selectedRows.length === 0 || saveMutation.isPending}
                  onClick={() => saveMutation.mutate(selectedRows)}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}{" "}
                  Save selected
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table table-sm table-zebra">
                <thead>
                  <tr>
                    <th>
                      <input
                        className="checkbox checkbox-xs"
                        type="checkbox"
                        aria-label="Select all rows"
                        checked={allSelected}
                        onChange={() =>
                          setSelected(
                            allSelected
                              ? new Set()
                              : new Set(rows.map((row) => row.keyword)),
                          )
                        }
                      />
                    </th>
                    <th>Keyword</th>
                    <th>Volume</th>
                    <th>Competition</th>
                    <th>Avg CPC</th>
                    <th>Bid range</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.keyword}>
                      <td>
                        <input
                          className="checkbox checkbox-xs"
                          type="checkbox"
                          aria-label={`Select ${row.keyword}`}
                          checked={selected.has(row.keyword)}
                          onChange={() =>
                            setSelected((current) => {
                              const next = new Set(current);
                              if (next.has(row.keyword))
                                next.delete(row.keyword);
                              else next.add(row.keyword);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td className="font-medium">{row.keyword}</td>
                      <td>{formatNumber(row.searchVolume)}</td>
                      <td>
                        {row.competitionLevel ?? "—"}
                        {row.competition === null
                          ? ""
                          : ` (${Math.round(row.competition * 100)})`}
                      </td>
                      <td>{formatMoney(row.averageCpc, row.currencyCode)}</td>
                      <td>
                        {formatMoney(row.lowTopOfPageBid, row.currencyCode)} –{" "}
                        {formatMoney(row.highTopOfPageBid, row.currencyCode)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
