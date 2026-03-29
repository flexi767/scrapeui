CREATE TABLE `competitor_listings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dealer_slug` text NOT NULL,
	`dealer_name` text NOT NULL,
	`url` text NOT NULL,
	`title` text,
	`make` text,
	`model` text,
	`price` integer,
	`currency` text DEFAULT 'EUR',
	`vat` text,
	`ad_status` text,
	`kaparo` integer DEFAULT 0,
	`is_new` integer DEFAULT 0,
	`last_edit` text,
	`reg_month` text,
	`reg_year` text,
	`mileage` integer,
	`fuel` text,
	`power` integer,
	`color` text,
	`snapshot_date` text,
	`scraped_at` text
);
--> statement-breakpoint
CREATE TABLE `mobilebg_backup_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`backup_id` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`filename` text NOT NULL,
	`source_url` text,
	`local_path` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`backup_id`) REFERENCES `mobilebg_backups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mobilebg_backup_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dealer_id` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`source_url` text,
	`listings_count` integer DEFAULT 0,
	`images_count` integer DEFAULT 0,
	`notes` text,
	`started_at` text,
	`finished_at` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`dealer_id`) REFERENCES `dealers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mobilebg_backups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer,
	`dealer_id` integer,
	`listing_id` integer,
	`mobile_id` text,
	`source_url` text,
	`source_title` text,
	`make` text,
	`model` text,
	`title` text,
	`price_amount` integer,
	`price_currency` text,
	`vat_included` integer,
	`year` integer,
	`mileage` integer,
	`fuel` text,
	`power` integer,
	`engine` text,
	`color` text,
	`transmission` text,
	`category` text,
	`description` text,
	`phones_json` text,
	`extras_json` text,
	`tech_data_json` text,
	`photo_order_json` text,
	`image_count` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`run_id`) REFERENCES `mobilebg_backup_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dealer_id`) REFERENCES `dealers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mobilebg_edit_form_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dealer_id` integer,
	`listing_id` integer,
	`backup_id` integer,
	`mobile_id` text,
	`source_url` text,
	`listing_token` text,
	`row_title` text,
	`row_price_text` text,
	`form_url` text,
	`forms_json` text,
	`fields_json` text,
	`checked_boxes_json` text,
	`checked_radios_json` text,
	`hidden_json` text,
	`screenshot_path` text,
	`created_at` text,
	FOREIGN KEY (`dealer_id`) REFERENCES `dealers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`backup_id`) REFERENCES `mobilebg_backups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mobilebg_repost_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dealer_id` integer,
	`backup_id` integer,
	`listing_id` integer,
	`source_mobile_id` text,
	`target_mobile_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`message` text,
	`preview_screenshot_path` text,
	`debug_dir` text,
	`started_at` text,
	`finished_at` text,
	`created_at` text,
	FOREIGN KEY (`dealer_id`) REFERENCES `dealers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`backup_id`) REFERENCES `mobilebg_backups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `listings` ADD `mobile_make_id` integer;--> statement-breakpoint
ALTER TABLE `listings` ADD `mobile_model_id` integer;--> statement-breakpoint
ALTER TABLE `listings` ADD `cars_make_id` integer;--> statement-breakpoint
ALTER TABLE `listings` ADD `cars_model_id` integer;--> statement-breakpoint
ALTER TABLE `listings` ADD `body_type` text;--> statement-breakpoint
ALTER TABLE `listings` ADD `transmission` text;--> statement-breakpoint
ALTER TABLE `listings` ADD `needs_sync` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `listings` ADD `cars_id` text;--> statement-breakpoint
ALTER TABLE `listings` ADD `cars_synced_at` text;