-- mobilebg_backups had no indexes. Every own-listings page view runs a
-- window function partitioned by (dealer_id, mobile_id), and list queries
-- join backups to listings on listing_id — both were full table scans.
CREATE INDEX IF NOT EXISTS idx_mobilebg_backups_dealer_mobile
  ON mobilebg_backups(dealer_id, mobile_id);

CREATE INDEX IF NOT EXISTS idx_mobilebg_backups_listing_id
  ON mobilebg_backups(listing_id);
