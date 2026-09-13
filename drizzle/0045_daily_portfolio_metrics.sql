CREATE TABLE `project_daily_metrics` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `project_id` text NOT NULL REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
  `organization_id` text NOT NULL REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
  `metric_date` text NOT NULL,
  `ga4_users` integer,
  `ga4_sessions` integer,
  `ga4_page_views` integer,
  `ga4_key_events` integer,
  `gsc_clicks` integer,
  `gsc_impressions` integer,
  `gsc_ctr` text,
  `gsc_position` text,
  `captured_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_daily_metrics_project_date_idx` ON `project_daily_metrics` (`project_id`,`metric_date`);
--> statement-breakpoint
CREATE INDEX `project_daily_metrics_organization_date_idx` ON `project_daily_metrics` (`organization_id`,`metric_date`);
