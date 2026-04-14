INSERT INTO `saved_searches` (`listing_id`, `fields_json`, `created_at`, `updated_at`)
SELECT
  p.`listing_id`,
  p.`fields_json`,
  COALESCE(p.`updated_at`, CURRENT_TIMESTAMP),
  p.`updated_at`
FROM `listing_search_profiles` p
WHERE NOT EXISTS (
  SELECT 1
  FROM `saved_searches` s
  WHERE s.`listing_id` = p.`listing_id`
);

CREATE TABLE `saved_searches_new` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `listing_id` integer,
  `fields_json` text NOT NULL,
  `created_at` text,
  `updated_at` text,
  FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);

INSERT INTO `saved_searches_new` (`id`, `listing_id`, `fields_json`, `created_at`, `updated_at`)
SELECT `id`, `listing_id`, `fields_json`, `created_at`, `updated_at`
FROM `saved_searches`;

DROP TABLE `saved_searches`;
ALTER TABLE `saved_searches_new` RENAME TO `saved_searches`;

CREATE UNIQUE INDEX `saved_searches_listing_unique_idx`
ON `saved_searches` (`listing_id`)
WHERE `listing_id` IS NOT NULL;

CREATE INDEX `saved_searches_listing_idx`
ON `saved_searches` (`listing_id`, `updated_at`);

DROP TABLE `listing_search_profiles`;
