import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getDailyPortfolio } from "@/serverFunctions/portfolio";

export function DailyPortfolio() {
  const query = useQuery({
    queryKey: ["dailyPortfolio"],
    queryFn: () => getDailyPortfolio(),
  });
  if (query.isPending) return <p>Loading daily portfolio…</p>;
  if (query.isError)
    return (
      <p className="alert alert-error">
        Couldn&apos;t load the daily portfolio.
      </p>
    );
  return (
    <section className="space-y-3 border border-base-300 rounded-xl p-4">
      <h2 className="text-lg font-semibold">Daily portfolio report</h2>
      <p className="text-sm text-base-content/70">
        Latest captured GA4 and Search Console day per site. Missing values mean
        the source is not connected or has not finalized data.
      </p>
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Site</th>
              <th>Date</th>
              <th>Users</th>
              <th>Sessions</th>
              <th>PV</th>
              <th>Conversions</th>
              <th>Clicks</th>
              <th>Impressions</th>
              <th>CTR</th>
              <th>Position</th>
              <th>Audit</th>
            </tr>
          </thead>
          <tbody>
            {query.data?.map(
              ({ project, metrics, alerts, criticalIssues, auditStatus }) => (
                <tr key={project.id}>
                  <td>
                    <Link
                      className="link"
                      to="/p/$projectId/analytics"
                      params={{ projectId: project.id }}
                    >
                      {project.name}
                    </Link>
                    {alerts.map((alert) => (
                      <p className="text-warning text-xs" key={alert}>
                        {alert}
                      </p>
                    ))}
                  </td>
                  <td>{metrics?.metricDate ?? "—"}</td>
                  <td>{metrics?.ga4Users?.toLocaleString() ?? "—"}</td>
                  <td>{metrics?.ga4Sessions?.toLocaleString() ?? "—"}</td>
                  <td>{metrics?.ga4PageViews?.toLocaleString() ?? "—"}</td>
                  <td>{metrics?.ga4KeyEvents?.toLocaleString() ?? "—"}</td>
                  <td>{metrics?.gscClicks?.toLocaleString() ?? "—"}</td>
                  <td>{metrics?.gscImpressions?.toLocaleString() ?? "—"}</td>
                  <td>
                    {metrics?.gscCtr
                      ? `${(Number(metrics.gscCtr) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                  <td>
                    {metrics?.gscPosition
                      ? Number(metrics.gscPosition).toFixed(1)
                      : "—"}
                  </td>
                  <td>
                    {auditStatus
                      ? `${criticalIssues} critical · ${auditStatus}`
                      : "—"}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
