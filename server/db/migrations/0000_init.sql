CREATE TABLE `attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`data` blob NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `counters` (
	`name` text PRIMARY KEY NOT NULL,
	`value` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`seq` text NOT NULL,
	`kind` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`applicant_email` text NOT NULL,
	`applicant_name` text NOT NULL,
	`department` text NOT NULL,
	`in_charge` text NOT NULL,
	`item_number` text NOT NULL,
	`item_name` text NOT NULL,
	`amount` integer,
	`quantity` text,
	`deadline` text,
	`remark` text DEFAULT '' NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	`attachment_id` integer,
	`payment_method` text,
	`executed_at` integer,
	`executed_by` text,
	FOREIGN KEY (`attachment_id`) REFERENCES `attachments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entries_seq_unique` ON `entries` (`seq`);