CREATE TABLE `users` (
	`email` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`bureau` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`last_login_at` integer NOT NULL
);
