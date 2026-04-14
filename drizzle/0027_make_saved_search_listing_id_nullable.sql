PRAGMA foreign_keys=off;
BEGIN;

CREATE TABLE `saved_searches_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`listing_id` integer,
	`legacy_profile_listing_id` integer,
	`fields_json` text NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE cascade
);

INSERT INTO `saved_searches_new` (`id`, `listing_id`, `legacy_profile_listing_id`, `fields_json`, `created_at`, `updated_at`)
SELECT `id`, `listing_id`, `legacy_profile_listing_id`, `fields_json`, `created_at`, `updated_at`
FROM `saved_searches`;

DROP TABLE `saved_searches`;
ALTER TABLE `saved_searches_new` RENAME TO `saved_searches`;

CREATE UNIQUE INDEX `saved_searches_legacy_profile_idx` ON `saved_searches` (`legacy_profile_listing_id`);
CREATE INDEX `saved_searches_listing_idx` ON `saved_searches` (`listing_id`, `updated_at`);

COMMIT;
PRAGMA foreign_keys=on;
