ALTER TABLE mobilebg_backups ADD COLUMN ad_status text;
ALTER TABLE mobilebg_backups ADD COLUMN kaparo integer DEFAULT 0;
ALTER TABLE mobilebg_backups ADD COLUMN draft_needs_sync integer DEFAULT 0;
ALTER TABLE mobilebg_backups ADD COLUMN last_mobile_sync_at text;

UPDATE mobilebg_backups
SET
  ad_status = COALESCE(ad_status, (
    SELECT l.ad_status
    FROM listings l
    WHERE l.id = mobilebg_backups.listing_id
  ), 'none'),
  kaparo = COALESCE(kaparo, (
    SELECT l.kaparo
    FROM listings l
    WHERE l.id = mobilebg_backups.listing_id
  ), 0),
  draft_needs_sync = COALESCE(draft_needs_sync, 0);
