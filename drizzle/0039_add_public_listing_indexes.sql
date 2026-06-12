CREATE INDEX IF NOT EXISTS `listings_public_dealer_make_idx`
ON `listings` (`dealer_id`, `is_active`, `duplicate`, `make`);

CREATE INDEX IF NOT EXISTS `listings_public_dealer_last_edit_idx`
ON `listings` (`dealer_id`, `is_active`, `duplicate`, `last_edit`, `id`);

CREATE INDEX IF NOT EXISTS `listings_public_dealer_price_idx`
ON `listings` (`dealer_id`, `is_active`, `duplicate`, `current_price`, `id`);

CREATE INDEX IF NOT EXISTS `listings_public_dealer_mileage_idx`
ON `listings` (`dealer_id`, `is_active`, `duplicate`, `mileage`, `id`);

CREATE INDEX IF NOT EXISTS `listings_public_dealer_year_idx`
ON `listings` (`dealer_id`, `is_active`, `duplicate`, `reg_year`, `id`);
