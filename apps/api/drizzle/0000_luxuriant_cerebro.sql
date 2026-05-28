CREATE TABLE `agent_memory` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`expires_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_agent_memory_type` ON `agent_memory` (`type`);--> statement-breakpoint
CREATE TABLE `ai_tool_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text,
	`session_id` text,
	`tool_name` text NOT NULL,
	`permission_level` text DEFAULT 'auto' NOT NULL,
	`args` text DEFAULT '{}' NOT NULL,
	`result` text,
	`error_message` text,
	`status` text NOT NULL,
	`duration_ms` integer,
	`undo_token` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ai_tool_calls_conversation` ON `ai_tool_calls` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_ai_tool_calls_tool` ON `ai_tool_calls` (`tool_name`,`created_at`);--> statement-breakpoint
CREATE TABLE `alarms` (
	`id` text PRIMARY KEY NOT NULL,
	`time` text NOT NULL,
	`label` text NOT NULL,
	`repeat_pattern` text DEFAULT 'once' NOT NULL,
	`repeat_days` text,
	`enabled` integer DEFAULT true NOT NULL,
	`alert_sound` text DEFAULT 'alarm',
	`last_fired_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bookmark_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`label` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookmark_categories_value_unique` ON `bookmark_categories` (`value`);--> statement-breakpoint
CREATE TABLE `bookmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`emoji` text,
	`category` text DEFAULT 'none' NOT NULL,
	`is_favorite` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `caldav_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`url` text NOT NULL,
	`username` text NOT NULL,
	`password_enc` text NOT NULL,
	`calendar_id` text,
	`last_synced_at` integer,
	`sync_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `calendars` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text DEFAULT '#6c5ce7' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text DEFAULT 'Nouvelle conversation' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_chat_messages_conversation` ON `chat_messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `connector_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`token` text NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connector_configs_type_unique` ON `connector_configs` (`type`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`birth_date` integer,
	`phone` text,
	`email` text,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dog_walks` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`ended_at` integer,
	`duration_seconds` integer,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `email_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`email` text NOT NULL,
	`imap_host` text NOT NULL,
	`imap_port` integer DEFAULT 993 NOT NULL,
	`imap_secure` integer DEFAULT true NOT NULL,
	`smtp_host` text NOT NULL,
	`smtp_port` integer DEFAULT 587 NOT NULL,
	`smtp_secure` integer DEFAULT false NOT NULL,
	`username` text NOT NULL,
	`password_enc` text NOT NULL,
	`last_synced_at` integer,
	`self_signed` integer DEFAULT false NOT NULL,
	`sync_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `email_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`condition_field` text NOT NULL,
	`condition_operator` text NOT NULL,
	`condition_value` text NOT NULL,
	`action_type` text NOT NULL,
	`action_value` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `emails` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`message_id` text NOT NULL,
	`imap_uid` integer,
	`subject` text,
	`from_address` text NOT NULL,
	`from_name` text,
	`to_addresses` text DEFAULT '[]' NOT NULL,
	`cc_addresses` text,
	`body_text` text,
	`body_html` text,
	`has_attachments` integer DEFAULT false NOT NULL,
	`attachment_names` text,
	`is_read` integer DEFAULT false NOT NULL,
	`is_starred` integer DEFAULT false NOT NULL,
	`is_archived` integer DEFAULT false NOT NULL,
	`folder` text DEFAULT 'INBOX' NOT NULL,
	`summary` text,
	`classification` text,
	`sent_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `email_accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_emails_account_folder` ON `emails` (`account_id`,`folder`,`sent_at`);--> statement-breakpoint
CREATE INDEX `idx_emails_unread` ON `emails` (`account_id`,`is_read`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`calendar_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`location` text,
	`latitude` real,
	`longitude` real,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`is_all_day` integer DEFAULT false NOT NULL,
	`recurrence_rule` text,
	`task_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `flux_items` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`flux_status` text NOT NULL,
	`decided_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_flux_entity` ON `flux_items` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_flux_status` ON `flux_items` (`flux_status`);--> statement-breakpoint
CREATE INDEX `idx_flux_type_status` ON `flux_items` (`entity_type`,`flux_status`);--> statement-breakpoint
CREATE INDEX `idx_flux_pagination` ON `flux_items` (`entity_type`,`flux_status`,`decided_at`);--> statement-breakpoint
CREATE TABLE `llm_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`base_url` text NOT NULL,
	`model` text NOT NULL,
	`api_key` text,
	`max_tokens` integer DEFAULT 2048 NOT NULL,
	`temperature` text DEFAULT '0.7' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#6c5ce7' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `push_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`read_at` integer
);
--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`type` text DEFAULT 'push' NOT NULL,
	`minutes_before` integer DEFAULT 15 NOT NULL,
	`scheduled_at` integer NOT NULL,
	`sent_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_reminders_pending` ON `reminders` (`scheduled_at`) WHERE sent_at IS NULL;--> statement-breakpoint
CREATE TABLE `routines` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`trigger_time` text NOT NULL,
	`trigger_days` text DEFAULT '1,2,3,4,5' NOT NULL,
	`steps` text DEFAULT '[]' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`last_run_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rss_articles` (
	`id` text PRIMARY KEY NOT NULL,
	`feed_id` text NOT NULL,
	`guid` text NOT NULL,
	`title` text,
	`link` text,
	`description` text,
	`content` text,
	`author` text,
	`published_at` integer,
	`is_read` integer DEFAULT false NOT NULL,
	`is_starred` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`feed_id`) REFERENCES `rss_feeds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_rss_articles_feed_published` ON `rss_articles` (`feed_id`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_rss_articles_unread` ON `rss_articles` (`feed_id`,`is_read`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_rss_articles_feed_guid` ON `rss_articles` (`feed_id`,`guid`);--> statement-breakpoint
CREATE TABLE `rss_feeds` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`url` text NOT NULL,
	`category` text,
	`site_url` text,
	`last_synced_at` integer,
	`sync_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `snippets` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`language` text DEFAULT 'text' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`is_favorite` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `synced_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text DEFAULT 'github' NOT NULL,
	`external_id` text NOT NULL,
	`pr_number` integer NOT NULL,
	`repo` text NOT NULL,
	`title` text NOT NULL,
	`state` text NOT NULL,
	`draft` integer DEFAULT false NOT NULL,
	`author` text NOT NULL,
	`url` text NOT NULL,
	`review_requested` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_synced_issues_source_external_id` ON `synced_issues` (`source`,`external_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`external_id` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'open' NOT NULL,
	`priority` text,
	`url` text,
	`labels` text DEFAULT '[]' NOT NULL,
	`assignees` text DEFAULT '[]' NOT NULL,
	`due_date` integer,
	`start_date` integer,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tasks_external_source` ON `tasks` (`external_id`,`source`);--> statement-breakpoint
CREATE INDEX `idx_tasks_source` ON `tasks` (`source`);--> statement-breakpoint
CREATE INDEX `idx_tasks_due_date` ON `tasks` (`due_date`);--> statement-breakpoint
CREATE TABLE `timer_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`actual_seconds` integer NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	`completed` integer DEFAULT true NOT NULL,
	`label` text,
	`task_id` text,
	`project_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`webhook_id` text NOT NULL,
	`payload` text NOT NULL,
	`received_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`read_at` integer,
	FOREIGN KEY (`webhook_id`) REFERENCES `webhooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_webhook_events_webhook` ON `webhook_events` (`webhook_id`,`received_at`);--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`secret` text NOT NULL,
	`source` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wellness_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`interval_minutes` integer NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`alert_sound` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wellness_configs_type_unique` ON `wellness_configs` (`type`);--> statement-breakpoint
CREATE TABLE `wellness_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`date` text NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	`goal` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
