CREATE TABLE `listing_search_profiles` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `listing_id` integer NOT NULL,
  `fields_json` text NOT NULL,
  `updated_at` text,
  FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `listing_search_profiles_listing_idx`
ON `listing_search_profiles` (`listing_id`);
