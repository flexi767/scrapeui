CREATE INDEX IF NOT EXISTS `listings_active_price_idx`
ON `listings` (`is_active`, `duplicate`, `current_price`);

CREATE INDEX IF NOT EXISTS `listings_active_last_edit_idx`
ON `listings` (`is_active`, `duplicate`, `last_edit`);

CREATE INDEX IF NOT EXISTS `listings_active_dealer_idx`
ON `listings` (`is_active`, `duplicate`, `dealer_id`);

CREATE INDEX IF NOT EXISTS `listings_active_make_model_idx`
ON `listings` (`is_active`, `duplicate`, `make`, `model`);

CREATE INDEX IF NOT EXISTS `listings_active_filter_facets_idx`
ON `listings` (`is_active`, `duplicate`, `reg_year`, `body_type`, `fuel`, `ad_status`);

CREATE INDEX IF NOT EXISTS `dealers_active_priority_idx`
ON `dealers` (`active`, `own`, `priority`, `name`);
