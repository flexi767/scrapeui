import type Database from 'better-sqlite3';

export function markSyncRunning(db: Database.Database, backupId: number): void {
  db.prepare(`
    UPDATE mobilebg_backups
    SET last_mobile_sync_status = 'running', last_mobile_sync_error = NULL, updated_at = ?
    WHERE id = ?
  `).run(new Date().toISOString(), backupId);
}

export function markSyncFailed(db: Database.Database, backupId: number, error: unknown): void {
  db.prepare(`
    UPDATE mobilebg_backups
    SET last_mobile_sync_status = 'failed', last_mobile_sync_error = ?, updated_at = ?
    WHERE id = ?
  `).run(error instanceof Error ? error.message : String(error), new Date().toISOString(), backupId);
}
