import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectDailyMetrics } from "@/db/schema";

async function upsert(values: typeof projectDailyMetrics.$inferInsert) {
  await db
    .insert(projectDailyMetrics)
    .values(values)
    .onConflictDoUpdate({
      target: [projectDailyMetrics.projectId, projectDailyMetrics.metricDate],
      set: { ...values },
    });
}

async function getForProjectDate(projectId: string, metricDate: string) {
  const [row] = await db
    .select()
    .from(projectDailyMetrics)
    .where(
      and(
        eq(projectDailyMetrics.projectId, projectId),
        eq(projectDailyMetrics.metricDate, metricDate),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function listLatestForOrganization(organizationId: string) {
  const rows = await db
    .select()
    .from(projectDailyMetrics)
    .where(eq(projectDailyMetrics.organizationId, organizationId))
    .orderBy(
      desc(projectDailyMetrics.metricDate),
      desc(projectDailyMetrics.id),
    );
  const latestByProject = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latestByProject.has(row.projectId))
      latestByProject.set(row.projectId, row);
  }
  return [...latestByProject.values()];
}

async function listLatestTwoForOrganization(organizationId: string) {
  const rows = await db
    .select()
    .from(projectDailyMetrics)
    .where(eq(projectDailyMetrics.organizationId, organizationId))
    .orderBy(
      desc(projectDailyMetrics.metricDate),
      desc(projectDailyMetrics.id),
    );
  const grouped = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = row.projectId;
    const prior = grouped.get(key);
    if (!prior) grouped.set(key, row);
  }
  return { latest: [...grouped.values()], rows };
}

export const ProjectDailyMetricsRepository = {
  upsert,
  getForProjectDate,
  listLatestForOrganization,
  listLatestTwoForOrganization,
};
