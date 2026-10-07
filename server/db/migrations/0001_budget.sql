CREATE TABLE `budget_lines` (
	`key` text PRIMARY KEY NOT NULL,
	`sort_order` integer NOT NULL,
	`item_number` text NOT NULL,
	`bureau` text DEFAULT '' NOT NULL,
	`team` text DEFAULT '' NOT NULL,
	`label` text NOT NULL,
	`quantity` text DEFAULT '' NOT NULL,
	`vendor` text DEFAULT '' NOT NULL,
	`budget_amount` integer NOT NULL,
	`link` text DEFAULT '' NOT NULL,
	`planned_timing` text DEFAULT '' NOT NULL,
	`remark` text DEFAULT '' NOT NULL,
	`imported_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `entry_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entry_id` integer NOT NULL,
	`line_key` text NOT NULL,
	`item_number` text NOT NULL,
	`label` text NOT NULL,
	`quantity` text DEFAULT '' NOT NULL,
	`budget_amount` integer NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE no action
);
