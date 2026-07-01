ALTER TABLE `questionnaires` ADD `short_id` text;--> statement-breakpoint
ALTER TABLE `questionnaires` ADD `slug` text DEFAULT '';--> statement-breakpoint
CREATE UNIQUE INDEX `questionnaires_short_id_unique` ON `questionnaires` (`short_id`);--> statement-breakpoint
ALTER TABLE `surveys` ADD `short_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `surveys_short_id_unique` ON `surveys` (`short_id`);