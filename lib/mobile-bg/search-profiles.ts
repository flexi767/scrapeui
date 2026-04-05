import { raw } from '@/db/client';

export interface SavedSearchField {
  name: string;
  label: string;
  value: string;
  source: 'default' | 'listing' | 'derived' | 'saved';
}

export interface SavedSearchProfile {
  listingId: number;
  fields: SavedSearchField[];
  updatedAt: string | null;
}

let searchProfileTableEnsured = false;

function ensureSearchProfileTable() {
  if (searchProfileTableEnsured) return;

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

  searchProfileTableEnsured = true;
}

function parseSavedFields(json: string | null | undefined): SavedSearchField[] {
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

      const source = candidate.source;
      return [{
        name: candidate.name,
        label: candidate.label,
        value: candidate.value,
        source: source === 'default' || source === 'listing' || source === 'derived' || source === 'saved'
          ? source
          : 'saved',
      }];
    });
  } catch {
    return [];
  }
}

export function getSavedSearchProfile(listingId: number): SavedSearchProfile | null {
  ensureSearchProfileTable();

  const row = raw.prepare(`
    SELECT listing_id, fields_json, updated_at
    FROM listing_search_profiles
    WHERE listing_id = ?
    LIMIT 1
  `).get(listingId) as { listing_id: number; fields_json: string; updated_at: string | null } | undefined;

  if (!row) return null;

  return {
    listingId: row.listing_id,
    fields: parseSavedFields(row.fields_json),
    updatedAt: row.updated_at,
  };
}

export function saveSearchProfile(listingId: number, fields: SavedSearchField[]) {
  ensureSearchProfileTable();
  const updatedAt = new Date().toISOString();
  raw.prepare(`
    INSERT INTO listing_search_profiles (listing_id, fields_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(listing_id) DO UPDATE SET
      fields_json = excluded.fields_json,
      updated_at = excluded.updated_at
  `).run(listingId, JSON.stringify(fields), updatedAt);

  return updatedAt;
}

export function deleteSearchProfile(listingId: number) {
  ensureSearchProfileTable();
  raw.prepare(`
    DELETE FROM listing_search_profiles
    WHERE listing_id = ?
  `).run(listingId);
}
