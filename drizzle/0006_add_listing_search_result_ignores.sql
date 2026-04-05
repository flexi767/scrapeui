CREATE TABLE `listing_search_result_ignores` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `listing_id` integer NOT NULL,
  `ignored_mobile_id` text NOT NULL,
  `created_at` text,
  FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `listing_search_result_ignores_listing_mobile_idx`
ON `listing_search_result_ignores` (`listing_id`, `ignored_mobile_id`);
