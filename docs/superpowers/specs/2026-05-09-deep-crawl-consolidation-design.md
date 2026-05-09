# Deep Crawl Consolidation Design

**Date:** 2026-05-09  
**Status:** Approved

## Problem

The codebase has two parallel data collection systems:

1. **Mobile.bg Backup** — login-based scraper that collects own-dealer listings, downloads images to disk, captures edit form snapshots, and writes to `mobilebg_backup*` tables.
2. **Deep Crawl** — public-page scraper that visits each listing's detail page and writes to `listings` + `listing_snapshots`.

The backup system was built on the assumption that login was required to get full listing data. That assumption is wrong — all listing data is publicly accessible. This created a second source of truth and unnecessary complexity.

## Goal

Make deep crawl the **single data collection path** for all dealers. Remove the backup scraper entirely. Keep the editown/sync workflow but seed it from `listings` (populated by deep crawl) rather than from backup runs.

## Architecture

### Single source of truth

```
Deep crawl (public pages)
        │
        ▼
   listings table  ◄──────────────── public display (/listings)
        │
        │ INSERT OR IGNORE (own dealers only, after crawl)
        ▼
mobilebg_backups  ◄────────────────── editown UI (/editown)
        │
        │ sync push
        ▼
    Mobile.bg
        │
        │ next deep crawl picks up changes
        ▼
   listings table
```

`listings` is always the display table. `mobilebg_backups` is only ever touched by the editown/sync workflow — never read for public display.

## What Gets Removed

### Files deleted
- `scraper/scripts/mobilebg-backup.ts` — standalone backup entry point
- `lib/mobile-bg/backup.ts` — main orchestrator (`backupDealerToDb`, `savePublicMobileBgListingAsDraft`)
- `lib/mobile-bg/backup-scraper.ts` — Playwright-based backup crawlers
- `lib/mobile-bg/backup-db.ts` — DB write operations for backup
- `lib/mobile-bg/backup-types.ts` — backup-specific types
- Any UI pages/components that exist solely to trigger or display backup runs

### Tables dropped
- `mobilebg_backup_images` — downloaded image metadata (image tracking moves to `listings` image fields)
- `mobilebg_crawl_queue` — 24-hour homepage cache used only by backup

### Tables renamed + repurposed
- `mobilebg_backup_runs` → `mobilebg_crawl_runs` — becomes the unified crawl run history for deep crawl. Currently only written by the backup scraper; after consolidation, written by `run-for-ui.ts` after each deep crawl. Two new columns added: `images_downloaded INT DEFAULT 0`, `images_failed INT DEFAULT 0`.

### Tables kept
- `mobilebg_backups` — editable draft layer for editown/sync workflow
- `mobilebg_edit_form_snapshots` — needed for on-demand repost

## What Gets Added to Deep Crawl

### Image download toggle

New `--download-images` CLI flag and `downloadImages: boolean` API param. Requires `--deep` to be active (full-res image URLs only available from detail pages).

When enabled:
- After each listing detail page is scraped, full-res images are downloaded to disk
- Path: `/mobilebg-backups/{dealerSlug}/{mobileId}/{filename}.webp` (same convention as backup)
- Skips files that already exist (deduplication by filename)
- Image events streamed via existing SSE: `image:downloaded`, `image:skipped`, `image:failed`

### Draft seeding for own dealers

After a deep crawl on a dealer with `mobile_user` set in `dealers`, run `INSERT OR IGNORE INTO mobilebg_backups` for every collected listing. Fields seeded: `mobile_id`, `dealer_id`, `source_url`, `title`, `make`, `model`, `price_amount`, `description`, `year`, `mileage`, `fuel`, `transmission`, `color`, `body_type`, `extras_json`.

**Existing drafts are never overwritten** — user edits are safe.

### Crawl run history

`run-for-ui.ts` (deep crawl) currently writes no run records. After consolidation it writes a record to `mobilebg_crawl_runs` (renamed from `mobilebg_backup_runs`) at start and updates it at completion with: `listings_count`, `images_downloaded`, `images_failed`, `status` (`completed` | `failed`), `finished_at`.

## API Changes

**POST `/api/scrape`** — add `downloadImages: boolean` to request body. Passes `--download-images` to the spawned script when `true`. No new endpoint.

## UI Changes

### Scraping config page
- New "Download images" toggle
- Toggle is disabled and greyed out when "Deep crawl" is off
- When both enabled, passes `downloadImages: true` to the scrape API

### Removed
- `app/(app)/mobilebg/backups/` — displays backup records from `mobilebg_backups` as a run artifact
- `app/(app)/mobilebg/crawl-queue/` — displays `mobilebg_crawl_queue` (table being dropped)
- The backup-runs section of `app/(app)/mobilebg/page.tsx` (dashboard summary for backup runs)

### Unchanged
- `/editown` — edit own listing drafts
- `/editown/sync` — batch sync changed drafts to Mobile.bg
- Edit form snapshot capture (triggered on-demand during sync/repost)
- All repost workflow pages

## Data Flow After Consolidation

| Action | Before | After |
|--------|--------|-------|
| Collect listing data | Two paths: deep crawl OR backup | One path: deep crawl only |
| Display listings | Read from `listings` | Read from `listings` (unchanged) |
| Seed own-dealer drafts | Backup run writes to `mobilebg_backups` | Deep crawl seeds `mobilebg_backups` (INSERT OR IGNORE) |
| Download images | Backup run downloads all images | Deep crawl downloads when toggle enabled |
| Edit form snapshot | Captured during backup run | Captured on-demand during sync/repost |
| Crawl history | Two tables: crawl runs + backup runs | One table: crawl runs (+ image stats columns) |

## Migration Steps (schema)

1. Rename `mobilebg_backup_runs` → `mobilebg_crawl_runs`
2. Add `images_downloaded INT DEFAULT 0`, `images_failed INT DEFAULT 0` columns to `mobilebg_crawl_runs`
3. Drop `mobilebg_backup_images` table
4. Drop `mobilebg_crawl_queue` table
