import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization } from "./better-auth-schema";
import { projects } from "./app.schema";

const isoNow = sql`to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export const projectDailyMetrics = pgTable(
  "project_daily_metrics",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    metricDate: text("metric_date").notNull(),
    ga4Users: integer("ga4_users"),
    ga4Sessions: integer("ga4_sessions"),
    ga4PageViews: integer("ga4_page_views"),
    ga4KeyEvents: integer("ga4_key_events"),
    gscClicks: integer("gsc_clicks"),
    gscImpressions: integer("gsc_impressions"),
    gscCtr: text("gsc_ctr"),
    gscPosition: text("gsc_position"),
    capturedAt: text("captured_at").notNull().default(isoNow),
  },
  (table) => [
    uniqueIndex("project_daily_metrics_project_date_idx").on(
      table.projectId,
      table.metricDate,
    ),
    index("project_daily_metrics_organization_date_idx").on(
      table.organizationId,
      table.metricDate,
    ),
  ],
);
