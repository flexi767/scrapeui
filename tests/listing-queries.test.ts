import { mkdtempSync, readFileSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Characterization tests for the listing queries (lib/query-modules/listings).
 * They pin the CURRENT behavior of the snapshot queries and the draft-overlay
 * logic so the SQL-fragment layer in query-modules/types.ts can be refactored
 * safely. Fixture schema: tests/fixtures/schema.sql (regenerate with
 * `sqlite3 <live db> .schema` minus FTS shadow tables when the schema changes).
 */

const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'scrapeui-test-'));
const dbPath = path.join(tmpDir, 'test.db');

// db/client.ts binds to DB_PATH at module load — set it before the dynamic import.
process.env.DB_PATH = dbPath;

type Queries = typeof import('@/lib/queries');
let queries: Queries;

function seed() {
  const db = new Database(dbPath);
  db.exec(readFileSync(path.join(__dirname, 'fixtures/schema.sql'), 'utf8'));

  const insertDealer = db.prepare(
    `INSERT INTO dealers (id, slug, name, own, active) VALUES (?, ?, ?, ?, ?)`,
  );
  insertDealer.run(1, 'own-dealer', 'Own Dealer', 1, 1);
  insertDealer.run(2, 'other-dealer', 'Other Dealer', 0, 1);
  insertDealer.run(3, 'inactive-dealer', 'Inactive Dealer', 0, 0);

  const insertListing = db.prepare(`
    INSERT INTO listings (
      id, dealer_id, mobile_id, title, make, model, current_price, vat,
      ad_status, is_active, duplicate, deleted_at, last_edit, views,
      mileage, fuel, reg_year
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  // FTS triggers index title/make/model on insert.
  insertListing.run(1, 1, 'm1', 'BMW 320d xDrive', 'BMW', '320', 30000, 'included',
    'active', 1, 0, null, '2024-05-01', 100, 120000, 'Дизел', '2018');
  insertListing.run(2, 1, 'm2', 'Audi A4 2.0 TDI', 'Audi', 'A4', 20000, 'included',
    'active', 1, 0, null, '2024-04-01', 50, 150000, 'Дизел', '2016');
  insertListing.run(3, 2, 'm3', 'BMW 530d', 'BMW', '530', 50000, 'excluded',
    'active', 1, 0, null, '2024-03-01', 200, 90000, 'Дизел', '2020');
  insertListing.run(4, 2, 'm4', 'BMW 530d duplicate', 'BMW', '530', 49000, 'excluded',
    'active', 1, 1, null, '2024-03-02', 10, 90000, 'Дизел', '2020');
  insertListing.run(5, 2, 'm5', 'Sold VW Golf', 'VW', 'Golf', 15000, 'included',
    'active', 0, 0, '2024-06-01', '2024-02-01', 30, 200000, 'Бензин', '2014');
  insertListing.run(6, 3, 'm6', 'Hidden dealer car', 'Opel', 'Astra', 9000, 'included',
    'active', 1, 0, null, '2024-01-01', 5, 220000, 'Бензин', '2012');

  const insertBackup = db.prepare(`
    INSERT INTO mobilebg_backups (
      id, dealer_id, listing_id, mobile_id, title, price_amount, vat_included,
      draft_needs_sync, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  // Draft with pending changes for listing 1: overlay must win.
  insertBackup.run(101, 1, 1, 'm1', 'BMW 320 M Sport', 31000, '1', 1,
    '2024-05-01T10:00:00', null);
  // Two backups for listing 2: the newer one (no pending changes) must be picked.
  insertBackup.run(102, 1, 2, 'm2', 'STALE OLD BACKUP', 19000, '0', 1,
    '2024-01-01T10:00:00', null);
  insertBackup.run(103, 1, 2, 'm2', 'Audi A4 newer backup', 20000, '0', 0,
    '2024-06-01T10:00:00', null);
  // Draft-only row (never published): no listing attached.
  insertBackup.run(104, 1, null, null, 'Unpublished draft', 12345, '1', 1,
    '2024-06-02T10:00:00', null);
  // Backup for a non-own dealer: must never appear in own listings.
  insertBackup.run(105, 2, 3, 'm3', 'Not own', 1, '1', 1,
    '2024-06-03T10:00:00', null);

  db.close();
}

beforeAll(async () => {
  seed();
  queries = await import('@/lib/queries');
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('getListings', () => {
  it('returns active, non-duplicate listings of active dealers, price desc by default', () => {
    const { data, total } = queries.getListings();
    expect(total).toBe(3);
    expect(data.map((row) => row.id)).toEqual([3, 1, 2]); // 50000, 30000, 20000
  });

  it('filters by exact make', () => {
    const { data, total } = queries.getListings({ make: 'BMW' });
    expect(total).toBe(2);
    expect(data.map((row) => row.id)).toEqual([3, 1]);
  });

  it('filters by dealer slug', () => {
    const { data, total } = queries.getListings({ dealerSlugs: ['own-dealer'] });
    expect(total).toBe(2);
    expect(data.map((row) => row.id)).toEqual([1, 2]);
    expect(data[0].dealer_slug).toBe('own-dealer');
  });

  it('full-text search matches by prefix', () => {
    const { data, total } = queries.getListings({ search: 'aud' });
    expect(total).toBe(1);
    expect(data[0].id).toBe(2);
  });

  it('paginates with a stable total', () => {
    const page1 = queries.getListings({ limit: 2, page: 1 });
    expect(page1.data.map((row) => row.id)).toEqual([3, 1]);
    expect(page1.total).toBe(3);

    const page2 = queries.getListings({ limit: 2, page: 2 });
    expect(page2.data.map((row) => row.id)).toEqual([2]);
    expect(page2.total).toBe(3);
  });

  it('supports ascending sort with a whitelisted column', () => {
    const { data } = queries.getListings({ sort: 'price', order: 'asc' });
    expect(data.map((row) => row.id)).toEqual([2, 1, 3]);
  });
});

describe('getDeletedListings', () => {
  it('returns only inactive listings with a deleted_at timestamp', () => {
    const { data, total } = queries.getDeletedListings();
    expect(total).toBe(1);
    expect(data[0].id).toBe(5);
    expect(data[0].deleted_at).toBe('2024-06-01');
  });
});

describe('getOwnListings (draft overlay)', () => {
  it('returns own-dealer rows with draft-only rows first', () => {
    const { data, total } = queries.getOwnListings();
    expect(total).toBe(3);
    // Draft-only (no listing) sorts first, then by last_edit desc.
    expect(data.map((row) => row.backup_id)).toEqual([104, 101, 103]);
    expect(data[0].id).toBeNull();
    expect(data[0].title).toBe('Unpublished draft');
  });

  it('overlays draft fields when the draft has pending changes', () => {
    const { data } = queries.getOwnListings();
    const row = data.find((r) => r.backup_id === 101)!;
    expect(row.title).toBe('BMW 320 M Sport'); // draft wins over 'BMW 320d xDrive'
    expect(row.current_price).toBe(31000); // draft price wins over 30000
    expect(row.vat).toBe('included'); // vat_included '1' normalized
    expect(row.needs_sync).toBe(1);
  });

  it('shows snapshot fields when the draft has no pending changes', () => {
    const { data } = queries.getOwnListings();
    const row = data.find((r) => r.backup_id === 103)!;
    expect(row.title).toBe('Audi A4 2.0 TDI'); // listing snapshot, not backup title
    expect(row.current_price).toBe(20000);
    expect(row.needs_sync).toBe(0);
  });

  it('picks the newest backup per (dealer, mobile_id), not stale ones', () => {
    const { data } = queries.getOwnListings();
    const backupIds = data.map((row) => row.backup_id);
    expect(backupIds).toContain(103);
    expect(backupIds).not.toContain(102); // stale older backup for the same listing
  });

  it('never includes backups of non-own dealers', () => {
    const { data } = queries.getOwnListings();
    expect(data.map((row) => row.backup_id)).not.toContain(105);
  });
});
