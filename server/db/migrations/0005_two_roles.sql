UPDATE `users` SET `role` = 'member' WHERE `role` NOT IN ('member', 'admin');--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `bureau`;
