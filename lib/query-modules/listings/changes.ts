import { raw } from '@/db/client';
import { firstBackupImageIdExpr } from '../types';

export interface TrackedChangeRow {
  id: number;
  listing_id: number;
  mobile_id: string | null;
  cars_id: string | null;
  title: string | null;
  make: string | null;
  model: string | null;
  dealer_name: string | null;
  dealer_slug: string | null;
  source: string | null;
  image_meta: string | null;
  thumb_keys: string | null;
  full_keys: string | null;
  images_downloaded: number | null;
  thumb_saved: number | null;
  first_backup_image_id: number | null;
  snapshot_price: number | null;
  snapshot_vat: string | null;
  snapshot_last_edit: string | null;
  snapshot_views: number | null;
  snapshot_ad_status: string | null;
  snapshot_kaparo: number | null;
  snapshot_title: string | null;
  snapshot_description: string | null;
  recorded_at: string;
  target_price: number | null;
  target_vat: string | null;
  target_last_edit: string | null;
  target_views: number | null;
  target_ad_status: string | null;
  target_kaparo: number | null;
  target_title: string | null;
  target_description: string | null;
  current_price: number | null;
  current_vat: string | null;
  current_last_edit: string | null;
  current_views: number | null;
  current_ad_status: string | null;
  current_kaparo: number | null;
  current_title: string | null;
  current_description: string | null;
}

export interface TrackedChangesFilters {
  make?: string;
  model?: string;
  dealerSlugs?: string[];
  fields?: string[];
  search?: string;
  whenStart?: string | null;
  whenEnd?: string | null;
  page?: number;
  limit?: number;
}

export interface TrackedChangeWindow {
  value: string;
  start: string;
  end: string;
  count: number;
}

const titleChangePredicate = `
  snapshot_title IS NOT NULL
  AND TRIM(snapshot_title) != ''
  AND snapshot_title != target_title
  AND target_title NOT LIKE '%' || snapshot_title
`;

function buildTrackedChangesWhere(filters: TrackedChangesFilters): {
  where: string;
  params: unknown[];
} {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters.make) {
    clauses.push("l.make = ?");
    params.push(filters.make);
  }
  if (filters.model) {
    clauses.push("l.model = ?");
    params.push(filters.model);
  }
  if (filters.dealerSlugs && filters.dealerSlugs.length > 0) {
    clauses.push(
      `d.slug IN (${filters.dealerSlugs.map(() => "?").join(", ")})`,
    );
    params.push(...filters.dealerSlugs);
  }
  if (filters.search) {
    clauses.push(`(
      l.title LIKE ?
      OR l.make LIKE ?
      OR l.model LIKE ?
      OR l.description LIKE ?
      OR d.name LIKE ?
      OR l.mobile_id LIKE ?
      OR l.cars_id LIKE ?
    )`);
    const like = `%${filters.search}%`;
    params.push(like, like, like, like, like, like, like);
  }
  if (filters.whenStart && filters.whenEnd) {
    clauses.push("s.recorded_at >= ? AND s.recorded_at <= ?");
    params.push(filters.whenStart, filters.whenEnd);
  }
  if (filters.fields && filters.fields.length > 0) {
    const fieldMap: Record<string, string> = {
      price: "s.price IS NOT NULL",
      vat: "s.vat IS NOT NULL",
      last_edit: "s.last_edit IS NOT NULL",
      views: "s.views IS NOT NULL",
      ad_status: "s.ad_status IS NOT NULL",
      kaparo: "s.kaparo IS NOT NULL",
      title: `s.title IS NOT NULL AND TRIM(s.title) != ''`,
      description: `s.description IS NOT NULL AND TRIM(s.description) != ''`,
    };
    const selectedClauses = filters.fields
      .map((field) => fieldMap[field])
      .filter(Boolean);
    if (selectedClauses.length > 0)
      clauses.push(`(${selectedClauses.join(" OR ")})`);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

export function getTrackedChangeWindows(): TrackedChangeWindow[] {
  const rows = raw
    .prepare(
      `
    SELECT recorded_at
    FROM listing_snapshots
    ORDER BY recorded_at DESC, id DESC
  `,
    )
    .all() as { recorded_at: string }[];

  const windows: TrackedChangeWindow[] = [];
  const windowMs = 10 * 60 * 1000;
  let current: {
    latestMs: number;
    latest: string;
    earliestMs: number;
    earliest: string;
    count: number;
  } | null = null;

  for (const row of rows) {
    const time = new Date(row.recorded_at).getTime();
    if (Number.isNaN(time)) continue;
    if (!current || current.latestMs - time > windowMs) {
      if (current) {
        windows.push({
          value: current.latest,
          start: current.earliest,
          end: current.latest,
          count: current.count,
        });
      }
      current = {
        latestMs: time,
        latest: row.recorded_at,
        earliestMs: time,
        earliest: row.recorded_at,
        count: 1,
      };
      continue;
    }

    current.earliestMs = time;
    current.earliest = row.recorded_at;
    current.count += 1;
  }

  if (current) {
    windows.push({
      value: current.latest,
      start: current.earliest,
      end: current.latest,
      count: current.count,
    });
  }

  return windows;
}

export function getTrackedChanges(filters: TrackedChangesFilters = {}): {
  data: TrackedChangeRow[];
  total: number;
} {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 50;
  const offset = (page - 1) * limit;
  const { where, params } = buildTrackedChangesWhere(filters);
  const actualChangeWhere = `
    (
      (snapshot_price IS NOT NULL AND snapshot_price != target_price) OR
      (snapshot_vat IS NOT NULL AND snapshot_vat != target_vat) OR
      (snapshot_last_edit IS NOT NULL AND snapshot_last_edit != target_last_edit) OR
      (snapshot_views IS NOT NULL AND snapshot_views != target_views) OR
      (snapshot_ad_status IS NOT NULL AND snapshot_ad_status != target_ad_status) OR
      (snapshot_kaparo IS NOT NULL AND snapshot_kaparo != target_kaparo) OR
      (${titleChangePredicate}) OR
      (snapshot_description IS NOT NULL AND TRIM(snapshot_description) != '' AND snapshot_description != target_description)
    )
  `;

  const baseFrom = `
    FROM listing_snapshots s
    JOIN listings l ON l.id = s.listing_id
    LEFT JOIN dealers d ON d.id = l.dealer_id
    ${where}
  `;

  const totalRow = raw
    .prepare(
      `
    WITH change_rows AS (
      SELECT
        s.price as snapshot_price,
        s.vat as snapshot_vat,
        s.last_edit as snapshot_last_edit,
        s.views as snapshot_views,
        s.ad_status as snapshot_ad_status,
        s.kaparo as snapshot_kaparo,
        s.title as snapshot_title,
        s.description as snapshot_description,
        COALESCE((
          SELECT s2.price
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.price IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.current_price) as target_price,
        COALESCE((
          SELECT s2.vat
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.vat IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.vat) as target_vat,
        COALESCE((
          SELECT s2.last_edit
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.last_edit IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.last_edit) as target_last_edit,
        COALESCE((
          SELECT s2.views
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.views IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), CASE WHEN l.source = 'c' THEN l.cars_total_views ELSE l.views END) as target_views,
        COALESCE((
          SELECT s2.ad_status
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.ad_status IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.ad_status) as target_ad_status,
        COALESCE((
          SELECT s2.kaparo
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.kaparo IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.kaparo) as target_kaparo,
        COALESCE((
          SELECT s2.title
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.title IS NOT NULL
            AND TRIM(s2.title) != ''
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.title) as target_title,
        COALESCE((
          SELECT s2.description
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.description IS NOT NULL
            AND TRIM(s2.description) != ''
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.description) as target_description
      ${baseFrom}
    )
    SELECT COUNT(*) as count
    FROM change_rows
    WHERE ${actualChangeWhere}
  `,
    )
    .get(...params) as { count: number };

  const data = raw
    .prepare(
      `
    WITH change_rows AS (
      SELECT
        s.id,
        s.listing_id,
        l.mobile_id,
        l.cars_id,
        l.title,
        l.make,
        l.model,
        d.name as dealer_name,
        d.slug as dealer_slug,
        l.source,
        l.image_meta,
        l.thumb_keys,
        l.full_keys,
        l.images_downloaded,
        l.thumb_saved,
        ${firstBackupImageIdExpr} as first_backup_image_id,
        s.price as snapshot_price,
        s.vat as snapshot_vat,
        s.last_edit as snapshot_last_edit,
        s.views as snapshot_views,
        s.ad_status as snapshot_ad_status,
        s.kaparo as snapshot_kaparo,
        s.title as snapshot_title,
        s.description as snapshot_description,
        s.recorded_at,
        COALESCE((
          SELECT s2.price
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.price IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.current_price) as target_price,
        COALESCE((
          SELECT s2.vat
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.vat IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.vat) as target_vat,
        COALESCE((
          SELECT s2.last_edit
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.last_edit IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.last_edit) as target_last_edit,
        COALESCE((
          SELECT s2.views
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.views IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), CASE WHEN l.source = 'c' THEN l.cars_total_views ELSE l.views END) as target_views,
        COALESCE((
          SELECT s2.ad_status
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.ad_status IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.ad_status) as target_ad_status,
        COALESCE((
          SELECT s2.kaparo
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.kaparo IS NOT NULL
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.kaparo) as target_kaparo,
        COALESCE((
          SELECT s2.title
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.title IS NOT NULL
            AND TRIM(s2.title) != ''
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.title) as target_title,
        COALESCE((
          SELECT s2.description
          FROM listing_snapshots s2
          WHERE s2.listing_id = s.listing_id
            AND s2.description IS NOT NULL
            AND TRIM(s2.description) != ''
            AND (s2.recorded_at > s.recorded_at OR (s2.recorded_at = s.recorded_at AND s2.id > s.id))
          ORDER BY s2.recorded_at ASC, s2.id ASC
          LIMIT 1
        ), l.description) as target_description,
        l.current_price,
        l.vat as current_vat,
        l.last_edit as current_last_edit,
        CASE WHEN l.source = 'c' THEN l.cars_total_views ELSE l.views END as current_views,
        l.ad_status as current_ad_status,
        l.kaparo as current_kaparo,
        l.title as current_title,
        l.description as current_description
      ${baseFrom}
    )
    SELECT *
    FROM change_rows
    WHERE ${actualChangeWhere}
    ORDER BY recorded_at DESC, id DESC
    LIMIT ? OFFSET ?
  `,
    )
    .all(...params, limit, offset) as TrackedChangeRow[];

  return { data, total: totalRow.count };
}
