import type Database from 'better-sqlite3';
import { currentIsoTimestamp } from '@/lib/date-format';
import { runInsert, runUpdate } from '@/lib/listings/sql';

export function createRepostJob(
  db: Database.Database,
  dealerId: number,
  backupId: number,
  listingId: number | null,
  sourceMobileId: string | null,
): number {
  const now = currentIsoTimestamp();
  const result = runInsert(db, 'mobilebg_repost_jobs', {
    dealer_id: dealerId,
    backup_id: backupId,
    listing_id: listingId,
    source_mobile_id: sourceMobileId,
    status: 'running',
    started_at: now,
    created_at: now,
  });
  return Number(result.lastInsertRowid);
}

export function markRepostJobCompleted(
  db: Database.Database,
  jobId: number,
  {
    targetMobileId,
    previewScreenshotPath,
    repostDir,
    resultUrl,
    now = currentIsoTimestamp(),
  }: {
    targetMobileId: string;
    previewScreenshotPath: string;
    repostDir: string;
    resultUrl: string;
    now?: string;
  },
): void {
  runUpdate(
    db,
    'mobilebg_repost_jobs',
    {
      status: 'completed',
      target_mobile_id: targetMobileId,
      preview_screenshot_path: previewScreenshotPath,
      debug_dir: repostDir,
      message: resultUrl,
      finished_at: now,
    },
    { sql: 'id = ?', params: [jobId] },
  );
}

export function markRepostJobFailed(
  db: Database.Database,
  jobId: number,
  {
    message,
    repostDir,
    now = currentIsoTimestamp(),
  }: {
    message: string;
    repostDir: string;
    now?: string;
  },
): void {
  runUpdate(
    db,
    'mobilebg_repost_jobs',
    {
      status: 'failed',
      message,
      debug_dir: repostDir,
      finished_at: now,
    },
    { sql: 'id = ?', params: [jobId] },
  );
}

export function markBackupPublished(
  db: Database.Database,
  backupId: number,
  {
    listingId,
    targetMobileId,
    resultUrl,
    now = currentIsoTimestamp(),
  }: {
    listingId: number;
    targetMobileId: string;
    resultUrl: string;
    now?: string;
  },
): void {
  runUpdate(
    db,
    'mobilebg_backups',
    {
      mobile_id: targetMobileId,
      source_url: resultUrl,
      draft_needs_sync: 0,
      last_mobile_sync_status: 'success',
      last_mobile_sync_error: null,
      last_mobile_sync_at: now,
      updated_at: now,
    },
    { sql: 'id = ?', params: [backupId] },
    [{ sql: 'listing_id = COALESCE(listing_id, ?)', params: [listingId] }],
  );
}
