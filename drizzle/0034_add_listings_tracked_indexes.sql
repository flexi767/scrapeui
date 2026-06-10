CREATE INDEX IF NOT EXISTS `idx_listings_dealer_id` ON `listings` (`dealer_id`);
CREATE INDEX IF NOT EXISTS `idx_listings_make_model` ON `listings` (`make`, `model`);
CREATE INDEX IF NOT EXISTS `idx_listing_snapshots_listing_id` ON `listing_snapshots` (`listing_id`);
