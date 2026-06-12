import type Database from 'better-sqlite3';
import { raw } from '@/db/client';
import { logger } from '@/lib/logger';

const log = logger.child('startup:db-performance');

const REQUIRED_TABLES = [
  'listings_search_fts',
  'listing_change_search_fts',
  'tasks_search_fts',
  'expenses_search_fts',
  'articles_search_fts',
  'listing_extras',
  'mobilebg_backup_extras',
] as const;

const REQUIRED_INDEXES = [
  'listing_extras_unique_idx',
  'listing_extras_label_listing_idx',
  'mobilebg_backup_extras_unique_idx',
  'mobilebg_backup_extras_label_backup_idx',
  'listings_active_price_idx',
  'listings_active_last_edit_idx',
  'listings_active_dealer_idx',
  'listings_active_make_model_idx',
  'listings_active_filter_facets_idx',
  'listings_public_dealer_make_idx',
  'listings_public_dealer_last_edit_idx',
  'listings_public_dealer_price_idx',
  'listings_public_dealer_mileage_idx',
  'listings_public_dealer_year_idx',
] as const;

const REQUIRED_TRIGGERS = [
  'listings_search_fts_after_insert',
  'listings_search_fts_after_delete',
  'listings_search_fts_after_update',
  'listing_change_search_fts_after_insert',
  'listing_change_search_fts_after_delete',
  'listing_change_search_fts_after_update',
  'tasks_search_fts_after_insert',
  'tasks_search_fts_after_delete',
  'tasks_search_fts_after_update',
  'expenses_search_fts_after_insert',
  'expenses_search_fts_after_delete',
  'expenses_search_fts_after_update',
  'articles_search_fts_after_insert',
  'articles_search_fts_after_delete',
  'articles_search_fts_after_update',
  'listing_extras_after_insert',
  'listing_extras_after_update',
  'listing_extras_after_delete',
  'mobilebg_backup_extras_after_insert',
  'mobilebg_backup_extras_after_update',
  'mobilebg_backup_extras_after_delete',
] as const;

interface SqliteReader {
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
  };
}

export interface DbPerformanceHealthReport {
  missingTables: string[];
  missingIndexes: string[];
  missingTriggers: string[];
}

function namesFromSqliteMaster(db: SqliteReader, type: 'table' | 'index' | 'trigger'): Set<string> {
  const rows = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = ?`)
    .all(type) as { name: string }[];
  return new Set(rows.map((row) => row.name));
}

function missingFrom(required: readonly string[], present: Set<string>): string[] {
  return required.filter((name) => !present.has(name));
}

export function inspectDbPerformanceHealth(db: SqliteReader): DbPerformanceHealthReport {
  return {
    missingTables: missingFrom(REQUIRED_TABLES, namesFromSqliteMaster(db, 'table')),
    missingIndexes: missingFrom(REQUIRED_INDEXES, namesFromSqliteMaster(db, 'index')),
    missingTriggers: missingFrom(REQUIRED_TRIGGERS, namesFromSqliteMaster(db, 'trigger')),
  };
}

export function formatDbPerformanceHealthIssues(report: DbPerformanceHealthReport): string[] {
  const issues: string[] = [];
  if (report.missingTables.length > 0) {
    issues.push(`missing tables: ${report.missingTables.join(', ')}`);
  }
  if (report.missingIndexes.length > 0) {
    issues.push(`missing indexes: ${report.missingIndexes.join(', ')}`);
  }
  if (report.missingTriggers.length > 0) {
    issues.push(`missing triggers: ${report.missingTriggers.join(', ')}`);
  }
  return issues;
}

export function assertDbPerformanceHealth(db: Database.Database = raw): void {
  const report = inspectDbPerformanceHealth(db);
  const issues = formatDbPerformanceHealthIssues(report);
  if (issues.length === 0) {
    log.info('Performance schema check passed');
    return;
  }

  const message = `Performance schema check failed: ${issues.join('; ')}`;
  if (process.env.NODE_ENV === 'production' && process.env.DB_PERFORMANCE_CHECK !== 'warn') {
    throw new Error(message);
  }

  log.warn(message);
}
