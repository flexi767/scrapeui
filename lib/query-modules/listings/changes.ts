import { raw } from '@/db/client';
import { firstBackupImageIdExpr } from '../types';
import { timedQuery } from '../query-utils';
import {
  actualTrackedChangePredicate,
  buildTrackedChangesWhere,
  type TrackedChangesFilters,
} from './change-filters';
import { trackedChangeTargetSelect } from './change-target-select';

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

export type { TrackedChangesFilters } from './change-filters';

export interface TrackedChangeWindow {
  value: string;
  start: string;
  end: string;
  count: number;
}

export function getTrackedChangeWindows(): TrackedChangeWindow[] {
  const rows = timedQuery('tracked-changes.windows', {}, () => raw
      .prepare(
        `
    SELECT recorded_at
    FROM listing_snapshots
    ORDER BY recorded_at DESC, id DESC
  `,
      )
      .all() as { recorded_at: string }[]);

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
  const queryDetails = {
    page,
    limit,
    filters: {
      make: Boolean(filters.make),
      model: Boolean(filters.model),
      dealers: filters.dealerSlugs?.length ?? 0,
      fields: filters.fields?.length ?? 0,
      search: Boolean(filters.search),
      whenStart: Boolean(filters.whenStart),
      whenEnd: Boolean(filters.whenEnd),
    },
  };

  const baseFrom = `
    FROM listing_snapshots s
    JOIN listings l ON l.id = s.listing_id
    LEFT JOIN dealers d ON d.id = l.dealer_id
    ${where}
  `;

  const data = timedQuery('tracked-changes.page', queryDetails, () => raw
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
        ${trackedChangeTargetSelect},
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
    SELECT change_rows.*
    FROM change_rows
    WHERE ${actualTrackedChangePredicate}
    ORDER BY recorded_at DESC, id DESC
    LIMIT ? OFFSET ?
  `,
      )
      .all(...params, limit, offset) as TrackedChangeRow[]);

  const countTrackedChanges = () => {
    const totalRow = timedQuery('tracked-changes.count', queryDetails, () => raw
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
        ${trackedChangeTargetSelect}
      ${baseFrom}
    )
    SELECT COUNT(*) as count
    FROM change_rows
    WHERE ${actualTrackedChangePredicate}
  `,
        )
        .get(...params) as { count: number });
    return totalRow.count;
  };

  return {
    data,
    total: countTrackedChanges(),
  };
}
