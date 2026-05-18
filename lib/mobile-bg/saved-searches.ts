import { raw } from "@/db/client";
import type { SearchField } from "@/lib/mobile-bg/search-form-shared";
import {
  getListingSearchPrefill,
  type SearchPrefillData,
} from "@/lib/mobile-bg/search-prefill";
import { parseJson } from "@/lib/utils";

export interface SavedSearchRecord {
  id: number;
  listingId: number | null;
  fields: SearchField[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SavedSearchSummary {
  id: number;
  listingId: number | null;
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
  const parsed = parseJson<unknown>(json, []);
  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.name !== "string" ||
      typeof candidate.label !== "string" ||
      typeof candidate.value !== "string"
    ) {
      return [];
    }

    return [
      {
        name: candidate.name,
        label: candidate.label,
        value: candidate.value,
        source:
          candidate.source === "default" ||
          candidate.source === "listing" ||
          candidate.source === "derived" ||
          candidate.source === "saved"
            ? candidate.source
            : "saved",
      },
    ];
  });
}

function ensureSavedSearchTables() {
  if (savedSearchTableEnsured) return;

  raw.exec(`
    CREATE TABLE IF NOT EXISTS saved_searches (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      listing_id integer,
      fields_json text NOT NULL,
      created_at text,
      updated_at text,
      FOREIGN KEY (listing_id) REFERENCES listings(id) ON UPDATE no action ON DELETE cascade
    );
  `);
  raw.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS saved_searches_listing_unique_idx
    ON saved_searches (listing_id)
    WHERE listing_id IS NOT NULL;
  `);
  raw.exec(`
    CREATE INDEX IF NOT EXISTS saved_searches_listing_idx
    ON saved_searches (listing_id, updated_at);
  `);

  savedSearchTableEnsured = true;
}

function toSummaryYearRange(fields: SearchField[]) {
  const byName = new Map(fields.map((field) => [field.name, field.value]));
  return {
    make: byName.get("marka") || null,
    model: byName.get("model") || null,
    yearFrom: byName.get("f10") || null,
    yearTo: byName.get("f11") || null,
  };
}

export function listSavedSearchSummaries(): SavedSearchSummary[] {
  ensureSavedSearchTables();

  const rows = raw
    .prepare(
      `
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
    LEFT JOIN listings l ON l.id = s.listing_id
    ORDER BY COALESCE(s.updated_at, s.created_at) DESC, s.id DESC
  `,
    )
    .all() as Array<{
    id: number;
    listing_id: number | null;
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
    const fallbackMake = range.make ?? null;
    const fallbackModel = range.model ?? null;
    return {
      id: row.id,
      listingId: row.listing_id,
      mobileId: row.mobile_id,
      make: fallbackMake ?? row.make,
      model: fallbackModel ?? row.model,
      title:
        row.title ??
        ([fallbackMake ?? row.make, fallbackModel ?? row.model]
          .filter(Boolean)
          .join(" ") ||
          null),
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

  const row = raw
    .prepare(
      `
    SELECT id, listing_id, fields_json, created_at, updated_at
    FROM saved_searches
    WHERE id = ?
    LIMIT 1
  `,
    )
    .get(id) as
    | {
        id: number;
        listing_id: number | null;
        fields_json: string;
        created_at: string | null;
        updated_at: string | null;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    listingId: row.listing_id,
    fields: parseSavedFields(row.fields_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getSavedSearchProfileByListingId(
  listingId: number,
): SavedSearchRecord | null {
  ensureSavedSearchTables();

  const row = raw
    .prepare(
      `
    SELECT id, listing_id, fields_json, created_at, updated_at
    FROM saved_searches
    WHERE listing_id = ?
    LIMIT 1
  `,
    )
    .get(listingId) as
    | {
        id: number;
        listing_id: number | null;
        fields_json: string;
        created_at: string | null;
        updated_at: string | null;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    listingId: row.listing_id,
    fields: parseSavedFields(row.fields_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getSavedSearchDetail(
  id: number,
): Promise<SavedSearchDetail | null> {
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

export function createSavedSearch(
  listingId: number | null,
  fields: SearchField[],
) {
  ensureSavedSearchTables();
  const now = new Date().toISOString();
  const result = raw
    .prepare(
      `
    INSERT INTO saved_searches (listing_id, fields_json, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `,
    )
    .run(listingId, JSON.stringify(fields), now, now);

  return Number(result.lastInsertRowid);
}

export function updateSavedSearch(id: number, fields: SearchField[]) {
  ensureSavedSearchTables();
  const now = new Date().toISOString();
  raw
    .prepare(
      `
    UPDATE saved_searches
    SET fields_json = ?, updated_at = ?
    WHERE id = ?
  `,
    )
    .run(JSON.stringify(fields), now, id);
  return now;
}

export function upsertSavedSearchProfile(
  listingId: number,
  fields: SearchField[],
) {
  ensureSavedSearchTables();
  const now = new Date().toISOString();
  raw
    .prepare(
      `
    INSERT INTO saved_searches (listing_id, fields_json, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(listing_id) DO UPDATE SET
      fields_json = excluded.fields_json,
      updated_at = excluded.updated_at
  `,
    )
    .run(listingId, JSON.stringify(fields), now, now);

  return now;
}

export function deleteSavedSearchProfileByListingId(listingId: number) {
  ensureSavedSearchTables();
  raw
    .prepare(
      `
    DELETE FROM saved_searches
    WHERE listing_id = ?
  `,
    )
    .run(listingId);
}

export function deleteSavedSearch(id: number) {
  ensureSavedSearchTables();
  raw
    .prepare(
      `
    DELETE FROM saved_searches
    WHERE id = ?
  `,
    )
    .run(id);
}
