import { raw } from '@/db/client';
import { currentIsoTimestamp } from '@/lib/date-format';

export interface IgnoredSearchResultRow {
  id: number;
  listing_id: number;
  ignored_mobile_id: string;
  created_at: string | null;
}

let searchIgnoreTableEnsured = false;

function ensureSearchIgnoreTable() {
  if (searchIgnoreTableEnsured) return;

  raw.exec(`
    CREATE TABLE IF NOT EXISTS listing_search_result_ignores (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      listing_id integer NOT NULL,
      ignored_mobile_id text NOT NULL,
      created_at text,
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON UPDATE no action ON DELETE cascade
    );
  `);
  raw.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS listing_search_result_ignores_listing_mobile_idx
    ON listing_search_result_ignores (listing_id, ignored_mobile_id);
  `);

  searchIgnoreTableEnsured = true;
}

export function getIgnoredSearchResultMobileIds(listingId: number): string[] {
  ensureSearchIgnoreTable();
  const rows = raw.prepare(`
    SELECT ignored_mobile_id
    FROM listing_search_result_ignores
    WHERE listing_id = ?
    ORDER BY id ASC
  `).all(listingId) as Array<{ ignored_mobile_id: string }>;

  return rows.map((row) => row.ignored_mobile_id).filter(Boolean);
}

export function listIgnoredSearchResults(listingId: number): IgnoredSearchResultRow[] {
  ensureSearchIgnoreTable();
  return raw.prepare(`
    SELECT id, listing_id, ignored_mobile_id, created_at
    FROM listing_search_result_ignores
    WHERE listing_id = ?
    ORDER BY id ASC
  `).all(listingId) as IgnoredSearchResultRow[];
}

export function addIgnoredSearchResult(listingId: number, ignoredMobileId: string) {
  ensureSearchIgnoreTable();
  const now = currentIsoTimestamp();
  raw.prepare(`
    INSERT OR IGNORE INTO listing_search_result_ignores (listing_id, ignored_mobile_id, created_at)
    VALUES (?, ?, ?)
  `).run(listingId, ignoredMobileId, now);
}

export function removeIgnoredSearchResult(listingId: number, ignoredMobileId: string) {
  ensureSearchIgnoreTable();
  raw.prepare(`
    DELETE FROM listing_search_result_ignores
    WHERE listing_id = ? AND ignored_mobile_id = ?
  `).run(listingId, ignoredMobileId);
}
