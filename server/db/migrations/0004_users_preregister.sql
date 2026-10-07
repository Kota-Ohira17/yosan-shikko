DROP INDEX "entries_seq_unique";--> statement-breakpoint
ALTER TABLE `users` ALTER COLUMN "last_login_at" TO "last_login_at" integer;--> statement-breakpoint
CREATE UNIQUE INDEX `entries_seq_unique` ON `entries` (`seq`);