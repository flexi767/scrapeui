CREATE INDEX IF NOT EXISTS `mobilebg_backups_latest_idx`
ON `mobilebg_backups` (`dealer_id`, `mobile_id`, `updated_at`, `created_at`, `id`);

CREATE INDEX IF NOT EXISTS `mobilebg_backups_listing_idx`
ON `mobilebg_backups` (`listing_id`);

CREATE INDEX IF NOT EXISTS `mobilebg_backup_images_backup_sort_idx`
ON `mobilebg_backup_images` (`backup_id`, `sort_order`, `id`);

CREATE INDEX IF NOT EXISTS `mobilebg_edit_form_snapshots_backup_latest_idx`
ON `mobilebg_edit_form_snapshots` (`backup_id`, `id`);
