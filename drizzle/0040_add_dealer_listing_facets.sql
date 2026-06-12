CREATE TABLE IF NOT EXISTS `dealer_listing_facets` (
  `dealer_id` integer NOT NULL,
  `facet_type` text NOT NULL,
  `facet_value` text NOT NULL,
  `listing_count` integer NOT NULL DEFAULT 0,
  `updated_at` text,
  PRIMARY KEY (`dealer_id`, `facet_type`, `facet_value`),
  FOREIGN KEY (`dealer_id`) REFERENCES `dealers`(`id`) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS `dealer_listing_facets_lookup_idx`
ON `dealer_listing_facets` (`dealer_id`, `facet_type`, `facet_value`);
