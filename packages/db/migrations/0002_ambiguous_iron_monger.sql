CREATE TABLE `question_options` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`is_correct` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_type` text NOT NULL,
	`parent_id` text NOT NULL,
	`section_id` text,
	`type` text NOT NULL,
	`prompt` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`required` integer DEFAULT true NOT NULL,
	`show_correct_answer` integer DEFAULT false NOT NULL,
	`case_sensitive` integer DEFAULT false NOT NULL,
	`acceptable_answers` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sections` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_type` text NOT NULL,
	`parent_id` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
