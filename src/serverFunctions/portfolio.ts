import { createServerFn } from "@tanstack/react-start";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";
import { ProjectService } from "@/server/features/projects/services/ProjectService";
import { ProjectDailyMetricsRepository } from "@/server/features/portfolio/repositories/ProjectDailyMetricsRepository";
import { DashboardService } from "@/server/features/dashboard/services/DashboardService";

export const getDailyPortfolio = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .handler(async ({ context }) => {
    const [projects, daily] = await Promise.all([
      ProjectService.listProjects(context.organizationId),
      ProjectDailyMetricsRepository.listLatestTwoForOrganization(
        context.organizationId,
      ),
    ]);
    const byProject = new Map<string, typeof daily.rows>();
    for (const row of daily.rows)
      byProject.set(row.projectId, [
        ...(byProject.get(row.projectId) ?? []),
        row,
      ]);
    return Promise.all(
      projects.map(async (project) => {
        const [metrics, previous] = byProject.get(project.id) ?? [];
        const alertInputs: Array<
          [string, number | null | undefined, number | null | undefined, number]
        > = [
          ["Sessions", metrics?.ga4Sessions, previous?.ga4Sessions, 20],
          ["Conversions", metrics?.ga4KeyEvents, previous?.ga4KeyEvents, 5],
          ["Search clicks", metrics?.gscClicks, previous?.gscClicks, 20],
        ];
        const alerts = alertInputs.flatMap(
          ([label, current, prior, minimum]) =>
            typeof current === "number" &&
            typeof prior === "number" &&
            prior >= minimum &&
            current / prior <= 0.5
              ? [
                  `${label} fell ${Math.round((1 - current / prior) * 100)}% from the previous captured day.`,
                ]
              : [],
        );
        const overview = await DashboardService.getOverview({
          projectId: project.id,
          domain: project.domain,
        });
        const criticalIssues =
          overview.audit?.topIssues
            .filter((issue) => issue.severity === "critical")
            .reduce((total, issue) => total + issue.count, 0) ?? 0;
        return {
          project,
          metrics: metrics ?? null,
          alerts,
          criticalIssues,
          auditStatus: overview.audit?.status ?? null,
        };
      }),
    );
  });
