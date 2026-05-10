-- scripts/migrate-crawl-runs.sql

-- Rename backup_runs to crawl_runs
ALTER TABLE mobilebg_backup_runs RENAME TO mobilebg_crawl_runs;

-- Add image tracking columns
ALTER TABLE mobilebg_crawl_runs ADD COLUMN images_downloaded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mobilebg_crawl_runs ADD COLUMN images_failed INTEGER NOT NULL DEFAULT 0;

-- Drop crawl_queue (backed by backup scraper, no longer used)
DROP TABLE IF EXISTS mobilebg_crawl_queue;
