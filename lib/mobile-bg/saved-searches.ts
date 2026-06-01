import { raw } from "@/db/client";
import { currentIsoTimestamp } from "@/lib/date-format";
import { runInsert, runUpdate } from "@/lib/listings/sql";
import { parseSearchFields, type SearchField } from "@/lib/mobile-bg/search-form-shared";
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

interface SavedSearchRecordRow {
  id: number;
  listing_id: number | null;
  fields_json: string;
  created_at: string | null;
  updated_at: string | null;
}

let savedSearchTableEnsured = false;

function parseSavedFields(json: string | null | undefined): SearchField[] {
  const parsed = parseJson<unknown>(json, []);
  return parseSearchFields(parsed) ?? [];
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

function mapSavedSearchRecord(row: SavedSearchRecordRow): SavedSearchRecord {
  return {
    id: row.id,
    listingId: row.listing_id,
    fields: parseSavedFields(row.fields_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getSavedSearchRecordWhere(column: "id" | "listing_id", value: number): SavedSearchRecord | null {
  ensureSavedSearchTables();

  const row = raw
    .prepare(
      `
    SELECT id, listing_id, fields_json, created_at, updated_at
    FROM saved_searches
    WHERE ${column} = ?
    LIMIT 1
  `,
    )
    .get(value) as SavedSearchRecordRow | undefined;

  return row ? mapSavedSearchRecord(row) : null;
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
  return getSavedSearchRecordWhere("id", id);
}

export function getSavedSearchProfileByListingId(
  listingId: number,
): SavedSearchRecord | null {
  return getSavedSearchRecordWhere("listing_id", listingId);
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
  const now = currentIsoTimestamp();
  const result = runInsert(raw, "saved_searches", {
    listing_id: listingId,
    fields_json: JSON.stringify(fields),
    created_at: now,
    updated_at: now,
  });

  return Number(result.lastInsertRowid);
}

export function updateSavedSearch(id: number, fields: SearchField[]) {
  ensureSavedSearchTables();
  const now = currentIsoTimestamp();
  runUpdate(
    raw,
    "saved_searches",
    { fields_json: JSON.stringify(fields), updated_at: now },
    { sql: "id = ?", params: [id] },
  );
  return now;
}

export function upsertSavedSearchProfile(
  listingId: number,
  fields: SearchField[],
) {
  ensureSavedSearchTables();
  const now = currentIsoTimestamp();
  const fieldsJson = JSON.stringify(fields);
  const saveProfile = raw.transaction(() => {
    const update = runUpdate(
      raw,
      "saved_searches",
      { fields_json: fieldsJson, updated_at: now },
      { sql: "listing_id = ?", params: [listingId] },
    );

    if (update.changes > 0) return;

    runInsert(raw, "saved_searches", {
      listing_id: listingId,
      fields_json: fieldsJson,
      created_at: now,
      updated_at: now,
    });
  });

  saveProfile();

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
