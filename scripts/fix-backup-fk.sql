PRAGMA foreign_keys = OFF;

CREATE TABLE mobilebg_backups_new (
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
  `ad_status` text,
  `kaparo` integer DEFAULT 0,
  `draft_needs_sync` integer DEFAULT 0,
  `last_mobile_sync_at` text,
  `last_mobile_sync_status` text,
  `last_mobile_sync_error` text,
  `search_checked_at` text,
  `search_original_position` integer,
  `search_price_position` integer,
  `search_first_result_price` real,
  `row_updated_text` text,
  `row_refresh_text` text,
  `row_viewed_at` text,
  `updated_on` text,
  `viewed_since_date` text,
  `views` integer,
  `watching` integer,
  FOREIGN KEY (`run_id`) REFERENCES `mobilebg_crawl_runs`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`dealer_id`) REFERENCES `dealers`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action
);

INSERT INTO mobilebg_backups_new SELECT
  id, run_id, dealer_id, listing_id, mobile_id, source_url, source_title,
  make, model, title, price_amount, price_currency, vat_included,
  year, mileage, fuel, power, engine, color, transmission, category,
  description, phones_json, extras_json, tech_data_json, photo_order_json,
  image_count, created_at, updated_at, ad_status, kaparo, draft_needs_sync,
  last_mobile_sync_at, last_mobile_sync_status, last_mobile_sync_error,
  search_checked_at, search_original_position, search_price_position,
  search_first_result_price, row_updated_text, row_refresh_text, row_viewed_at,
  updated_on, viewed_since_date, views, watching
FROM mobilebg_backups;

DROP TABLE mobilebg_backups;
ALTER TABLE mobilebg_backups_new RENAME TO mobilebg_backups;

PRAGMA foreign_keys = ON;
PRAGMA foreign_key_check(mobilebg_backups);
