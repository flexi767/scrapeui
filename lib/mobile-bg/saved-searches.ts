import { raw } from '@/db/client';
import {
  getListingSearchPrefill,
  type SearchField,
  type SearchPrefillData,
} from '@/lib/mobile-bg/search-prefill';

export interface SavedSearchRecord {
  id: number;
  listingId: number;
  legacyProfileListingId: number | null;
  fields: SearchField[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SavedSearchSummary {
  id: number;
  listingId: number;
  mobileId: string | null;
  make: string | null;
  model: string | null;
  title: string | null;
  regYear: string | null;
  yearFrom: string | null;
  yearTo: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SavedSearchDetail {
  search: SavedSearchRecord;
  prefill: SearchPrefillData;
}

let savedSearchTableEnsured = false;

function parseSavedFields(json: string | null | undefined): SearchField[] {
  if (!json) return [];

  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const candidate = entry as Record<string, unknown>;
      if (
        typeof candidate.name !== 'string' ||
        typeof candidate.label !== 'string' ||
        typeof candidate.value !== 'string'
      ) {
        return [];
      }

      return [{
        name: candidate.name,
        label: candidate.label,
        value: candidate.value,
        source:
          candidate.source === 'default' ||
          candidate.source === 'listing' ||
          candidate.source === 'derived' ||
          candidate.source === 'saved'
            ? candidate.source
            : 'saved',
      }];
    });
  } catch {
    return [];
  }
}

function ensureSavedSearchTables() {
  if (savedSearchTableEnsured) return;

  raw.exec(`
    CREATE TABLE IF NOT EXISTS listing_search_profiles (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      listing_id integer NOT NULL,
      fields_json text NOT NULL,
      updated_at text,
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON UPDATE no action ON DELETE cascade
    );
  `);
  raw.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS listing_search_profiles_listing_idx
    ON listing_search_profiles (listing_id);
  `);

  raw.exec(`
    CREATE TABLE IF NOT EXISTS saved_searches (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      listing_id integer NOT NULL,
      legacy_profile_listing_id integer,
      fields_json text NOT NULL,
      created_at text,
      updated_at text,
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON UPDATE no action ON DELETE cascade
    );
  `);
  raw.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS saved_searches_legacy_profile_idx
    ON saved_searches (legacy_profile_listing_id);
  `);
  raw.exec(`
    CREATE INDEX IF NOT EXISTS saved_searches_listing_idx
    ON saved_searches (listing_id, updated_at);
  `);

  raw.prepare(`
    INSERT INTO saved_searches (listing_id, legacy_profile_listing_id, fields_json, created_at, updated_at)
    SELECT
      p.listing_id,
      p.listing_id,
      p.fields_json,
      COALESCE(p.updated_at, CURRENT_TIMESTAMP),
      p.updated_at
    FROM listing_search_profiles p
    WHERE NOT EXISTS (
      SELECT 1
      FROM saved_searches s
      WHERE s.legacy_profile_listing_id = p.listing_id
    )
  `).run();

  savedSearchTableEnsured = true;
}

function toSummaryYearRange(fields: SearchField[]) {
  const byName = new Map(fields.map((field) => [field.name, field.value]));
  return {
    yearFrom: byName.get('f10') || null,
    yearTo: byName.get('f11') || null,
  };
}

export function listSavedSearchSummaries(): SavedSearchSummary[] {
  ensureSavedSearchTables();

  const rows = raw.prepare(`
    SELECT
      s.id,
      s.listing_id,
      s.fields_json,
      s.created_at,
      s.updated_at,
      l.mobile_id,
      l.make,
      l.model,
      l.title,
      l.reg_year
    FROM saved_searches s
    JOIN listings l ON l.id = s.listing_id
    ORDER BY COALESCE(s.updated_at, s.created_at) DESC, s.id DESC
  `).all() as Array<{
    id: number;
    listing_id: number;
    fields_json: string;
    created_at: string | null;
    updated_at: string | null;
    mobile_id: string | null;
    make: string | null;
    model: string | null;
    title: string | null;
    reg_year: string | null;
  }>;

  return rows.map((row) => {
    const fields = parseSavedFields(row.fields_json);
    const range = toSummaryYearRange(fields);
    return {
      id: row.id,
      listingId: row.listing_id,
      mobileId: row.mobile_id,
      make: row.make,
      model: row.model,
      title: row.title,
      regYear: row.reg_year,
      yearFrom: range.yearFrom,
      yearTo: range.yearTo,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

export function getSavedSearchRecord(id: number): SavedSearchRecord | null {
  ensureSavedSearchTables();

  const row = raw.prepare(`
    SELECT id, listing_id, legacy_profile_listing_id, fields_json, created_at, updated_at
    FROM saved_searches
    WHERE id = ?
    LIMIT 1
  `).get(id) as {
    id: number;
    listing_id: number;
    legacy_profile_listing_id: number | null;
    fields_json: string;
    created_at: string | null;
    updated_at: string | null;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    listingId: row.listing_id,
    legacyProfileListingId: row.legacy_profile_listing_id,
    fields: parseSavedFields(row.fields_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getSavedSearchDetail(id: number): Promise<SavedSearchDetail | null> {
  const search = getSavedSearchRecord(id);
  if (!search) return null;

  const prefill = await getListingSearchPrefill(search.listingId, {
    includeLocationOptions: true,
    overrideFields: search.fields,
    useSavedProfile: false,
  });

  if (!prefill) return null;

  return {
    search,
    prefill,
  };
}

export function createSavedSearch(listingId: number, fields: SearchField[]) {
  ensureSavedSearchTables();
  const now = new Date().toISOString();
  const result = raw.prepare(`
    INSERT INTO saved_searches (listing_id, fields_json, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(listingId, JSON.stringify(fields), now, now);

  return Number(result.lastInsertRowid);
}

export function updateSavedSearch(id: number, fields: SearchField[]) {
  ensureSavedSearchTables();
  const now = new Date().toISOString();
  raw.prepare(`
    UPDATE saved_searches
    SET fields_json = ?, updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(fields), now, id);
  return now;
}
