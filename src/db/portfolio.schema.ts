import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { organization } from "./better-auth-schema";
import { projects } from "./app.schema";

/** A durable daily fact table for trends, alerts, and portfolio reports. */
export const projectDailyMetrics = sqliteTable(
  "project_daily_metrics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // Calendar day in the source property's timezone (YYYY-MM-DD).
    metricDate: text("metric_date").notNull(),
    ga4Users: integer("ga4_users"),
    ga4Sessions: integer("ga4_sessions"),
    ga4PageViews: integer("ga4_page_views"),
    ga4KeyEvents: integer("ga4_key_events"),
    gscClicks: integer("gsc_clicks"),
    gscImpressions: integer("gsc_impressions"),
    // Decimal values are text so SQLite and Postgres preserve the same value.
    gscCtr: text("gsc_ctr"),
    gscPosition: text("gsc_position"),
    capturedAt: text("captured_at")
      .notNull()
      .default(sql`(current_timestamp)`),
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
