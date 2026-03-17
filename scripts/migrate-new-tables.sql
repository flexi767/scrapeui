-- New tables for dealership management system
-- Run with: sqlite3 /Users/v/dev/scraped/listings.db < scripts/migrate-new-tables.sql

CREATE TABLE IF NOT EXISTS `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` text
);
CREATE UNIQUE INDEX IF NOT EXISTS `users_username_unique` ON `users` (`username`);

CREATE TABLE IF NOT EXISTS `labels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#6b7280' NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `labels_name_unique` ON `labels` (`name`);

CREATE TABLE IF NOT EXISTS `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'backlog' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`assignee_id` integer,
	`created_by_id` integer,
	`parent_id` integer,
	`deadline` text,
	`is_recurring` integer DEFAULT 0,
	`recur_rule` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`),
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`)
);

CREATE TABLE IF NOT EXISTS `task_listings` (
	`task_id` integer NOT NULL,
	`listing_id` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE cascade,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`)
);

CREATE TABLE IF NOT EXISTS `task_deps` (
	`task_id` integer NOT NULL,
	`depends_on_id` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE cascade,
	FOREIGN KEY (`depends_on_id`) REFERENCES `tasks`(`id`) ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `task_labels` (
	`task_id` integer NOT NULL,
	`label_id` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE cascade,
	FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`author_id` integer NOT NULL,
	`body` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`)
);

CREATE TABLE IF NOT EXISTS `time_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`description` text,
	`duration_minutes` integer NOT NULL,
	`date` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);

CREATE TABLE IF NOT EXISTS `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`date` text NOT NULL,
	`category` text NOT NULL,
	`notes` text,
	`created_by_id` integer,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`)
);

CREATE TABLE IF NOT EXISTS `expense_listings` (
	`expense_id` integer NOT NULL,
	`listing_id` integer NOT NULL,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON DELETE cascade,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`)
);

CREATE TABLE IF NOT EXISTS `expense_tasks` (
	`expense_id` integer NOT NULL,
	`task_id` integer NOT NULL,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`)
);

CREATE TABLE IF NOT EXISTS `expense_labels` (
	`expense_id` integer NOT NULL,
	`label_id` integer NOT NULL,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON DELETE cascade,
	FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `uploads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filename` text NOT NULL,
	`stored_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`entity_type` text,
	`entity_id` integer,
	`uploaded_by_id` integer,
	`created_at` text,
	FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`)
);

CREATE TABLE IF NOT EXISTS `articles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`body` text NOT NULL,
	`author_id` integer NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`)
);
CREATE UNIQUE INDEX IF NOT EXISTS `articles_slug_unique` ON `articles` (`slug`);

CREATE TABLE IF NOT EXISTS `article_labels` (
	`article_id` integer NOT NULL,
	`label_id` integer NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON DELETE cascade,
	FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `article_listings` (
	`article_id` integer NOT NULL,
	`listing_id` integer NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON DELETE cascade,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`)
);

CREATE TABLE IF NOT EXISTS `article_dealers` (
	`article_id` integer NOT NULL,
	`dealer_id` integer NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON DELETE cascade,
	FOREIGN KEY (`dealer_id`) REFERENCES `dealers`(`id`)
);

CREATE TABLE IF NOT EXISTS `article_tasks` (
	`article_id` integer NOT NULL,
	`task_id` integer NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`)
);

CREATE TABLE IF NOT EXISTS `article_expenses` (
	`article_id` integer NOT NULL,
	`expense_id` integer NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON DELETE cascade,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`)
);

CREATE TABLE IF NOT EXISTS `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`title` text NOT NULL,
	`read_at` text,
	`created_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);

CREATE TABLE IF NOT EXISTS `activity_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`action` text NOT NULL,
	`detail` text,
	`user_id` integer,
	`created_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
