CREATE TABLE `mobilebg_crawl_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dealer_id` integer NOT NULL,
	`url` text NOT NULL,
	`url_type` text NOT NULL,
	`mobile_id` text,
	`status` text NOT NULL DEFAULT 'pending',
	`listings_count` integer,
	`price` integer,
	`views` integer,
	`last_crawled_at` text,
	`next_crawl_at` text,
	`error` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`dealer_id`) REFERENCES `dealers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mobilebg_crawl_queue_dealer_url_idx` on `mobilebg_crawl_queue` (`dealer_id`,`url`);
