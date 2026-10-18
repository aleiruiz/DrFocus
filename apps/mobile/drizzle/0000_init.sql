CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`type_id` text NOT NULL,
	`template_version` integer NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`expected_result` text DEFAULT '' NOT NULL,
	`requirements_json` text DEFAULT '{}' NOT NULL,
	`deadline_at` text NOT NULL,
	`deadline_zone` text NOT NULL,
	`status` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `activities_status_idx` ON `activities` (`status`,`deleted_at`);--> statement-breakpoint
CREATE TABLE `agent_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text,
	`request_id` text NOT NULL,
	`input_json` text NOT NULL,
	`proposed_json` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `availability_exceptions` (
	`id` text PRIMARY KEY NOT NULL,
	`local_date` text NOT NULL,
	`start_local` text NOT NULL,
	`end_local` text NOT NULL,
	`kind` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `availability_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`weekday` integer NOT NULL,
	`start_local` text NOT NULL,
	`end_local` text NOT NULL,
	`timezone` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `form_drafts` (
	`type_id` text PRIMARY KEY NOT NULL,
	`json` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `local_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`entity_id` text,
	`occurred_at` text NOT NULL,
	`properties_json` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_time_idx` ON `local_events` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `objective_dependencies` (
	`objective_id` text NOT NULL,
	`depends_on_id` text NOT NULL,
	PRIMARY KEY(`objective_id`, `depends_on_id`),
	FOREIGN KEY (`objective_id`) REFERENCES `objectives`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`depends_on_id`) REFERENCES `objectives`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "no_self_dependency" CHECK("objective_dependencies"."objective_id" <> "objective_dependencies"."depends_on_id")
);
--> statement-breakpoint
CREATE TABLE `objectives` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`title` text NOT NULL,
	`expected_result` text NOT NULL,
	`estimated_minutes` integer NOT NULL,
	`remaining_minutes` integer NOT NULL,
	`due_at` text,
	`status` text NOT NULL,
	`order_index` integer NOT NULL,
	`completed_at` text,
	`source` text NOT NULL,
	`is_review` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `objectives_activity_idx` ON `objectives` (`activity_id`,`order_index`);--> statement-breakpoint
CREATE INDEX `objectives_status_idx` ON `objectives` (`status`);--> statement-breakpoint
CREATE TABLE `plan_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`kind` text NOT NULL,
	`base_revision` integer NOT NULL,
	`proposed_json` text NOT NULL,
	`assumptions_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`accepted_at` text,
	`state` text NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `revisions_activity_idx` ON `plan_revisions` (`activity_id`,`state`);--> statement-breakpoint
CREATE TABLE `preferences` (
	`singleton_id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`role` text NOT NULL,
	`timezone` text NOT NULL,
	`preferred_block_minutes` integer DEFAULT 20 NOT NULL,
	`reminders_enabled` integer DEFAULT true NOT NULL,
	`quiet_start` text DEFAULT '21:00' NOT NULL,
	`quiet_end` text DEFAULT '08:00' NOT NULL,
	`daily_cap` integer DEFAULT 4 NOT NULL,
	`participant_alias` text NOT NULL,
	`onboarding_version` integer DEFAULT 0 NOT NULL,
	`reminders_covered_until` text
);
--> statement-breakpoint
CREATE TABLE `scheduled_reminders` (
	`native_id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`objective_id` text,
	`kind` text NOT NULL,
	`fire_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `work_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`objective_id` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`timezone` text NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	FOREIGN KEY (`objective_id`) REFERENCES `objectives`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_start_idx` ON `work_sessions` (`starts_at`);--> statement-breakpoint
CREATE INDEX `sessions_objective_idx` ON `work_sessions` (`objective_id`);