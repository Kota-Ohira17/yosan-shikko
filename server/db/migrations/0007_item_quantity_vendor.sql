ALTER TABLE `entry_items` ADD `vendor` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `entry_items` ADD `actual_quantity` text;--> statement-breakpoint
ALTER TABLE `entry_items` ADD `actual_vendor` text;