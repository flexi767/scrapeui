import { raw } from "@/db/client";
import { currentIsoTimestamp } from "@/lib/date-format";
import { runInsert } from "@/lib/listings/sql";
import type {
  EditOwnSyncRow,
  MakeModelMappingRow,
  MobileBgDashboardSummary,
  MobileBgEditFormDetailRow,
  MobileBgEditFormRow,
  MobileBgCrawlRunRow,
  MobileBgRepostJobRow,
} from "./types";
import {
  ownAdStatusExpr,
  ownEffectiveVatExpr,
  ownKaparoExpr,
  ownMakeExpr,
  ownModelExpr,
  ownNeedsSyncExpr,
  ownPriceExpr,
  ownTitleExpr,
  rankedBackupsCte,
} from "./types";

export function getMakeModelMappings(limit = 500, offset = 0): MakeModelMappingRow[] {
  return raw
    .prepare(
      `
    SELECT
      l.make,
      l.model,
      l.mobile_make_id,
      l.mobile_model_id,
      l.cars_make_id,
      l.cars_model_id,
      COUNT(*) as listing_count,
      MIN(l.mobile_id) as sample_mobile_id,
      MIN(l.title) as sample_title,
      GROUP_CONCAT(DISTINCT d.name) as dealer_names,
      MAX(l.last_edit) as latest_last_edit
    FROM listings l
    LEFT JOIN dealers d ON l.dealer_id = d.id
    WHERE l.is_active = 1
    GROUP BY
      l.make,
      l.model,
      l.mobile_make_id,
      l.mobile_model_id,
      l.cars_make_id,
      l.cars_model_id
    ORDER BY
      CASE
        WHEN l.mobile_make_id IS NULL OR l.mobile_model_id IS NULL OR l.cars_make_id IS NULL OR l.cars_model_id IS NULL THEN 0
        ELSE 1
      END,
      COUNT(*) DESC,
      l.make,
      l.model
    LIMIT ?
    OFFSET ?
  `,
    )
    .all(limit, offset) as MakeModelMappingRow[];
}

export function getMobileBgDashboardSummary(): MobileBgDashboardSummary {
  return raw
    .prepare(
      `
    SELECT
      (SELECT COUNT(*) FROM mobilebg_crawl_runs) as crawlRuns,
      (
        SELECT COUNT(*)
        FROM (
          SELECT 1
          FROM mobilebg_backups
          GROUP BY dealer_id, mobile_id
        )
      ) as backups,
      (SELECT COUNT(*) FROM mobilebg_edit_form_snapshots) as editForms,
      (SELECT COUNT(*) FROM mobilebg_repost_jobs) as repostJobs
  `,
    )
    .get() as MobileBgDashboardSummary;
}

export function getMobileBgCrawlRuns(limit = 20): MobileBgCrawlRunRow[] {
  return raw
    .prepare(
      `
    SELECT
      r.id, r.status, r.source_url, r.listings_count, r.images_count,
      r.images_downloaded, r.images_failed, r.notes,
      r.started_at, r.finished_at, r.created_at, r.updated_at,
      d.name as dealer_name, d.slug as dealer_slug
    FROM mobilebg_crawl_runs r
    LEFT JOIN dealers d ON r.dealer_id = d.id
    ORDER BY COALESCE(r.started_at, r.created_at) DESC, r.id DESC
    LIMIT ?
  `,
    )
    .all(limit) as MobileBgCrawlRunRow[];
}

export function createCrawlRun(dealerId: number, sourceUrl: string): number {
  const now = currentIsoTimestamp();
  const result = runInsert(raw, "mobilebg_crawl_runs", {
    dealer_id: dealerId,
    source_url: sourceUrl,
    status: "running",
    started_at: now,
    created_at: now,
    updated_at: now,
  });
  return result.lastInsertRowid as number;
}

export function updateCrawlRun(
  runId: number,
  data: {
    status: "completed" | "failed";
    listingsCount: number;
    imagesDownloaded: number;
    imagesFailed: number;
  },
): void {
  const now = currentIsoTimestamp();
  raw
    .prepare(
      `
    UPDATE mobilebg_crawl_runs
    SET status = ?, listings_count = ?, images_downloaded = ?, images_failed = ?,
        finished_at = ?, updated_at = ?
    WHERE id = ?
  `,
    )
    .run(
      data.status,
      data.listingsCount,
      data.imagesDownloaded,
      data.imagesFailed,
      now,
      now,
      runId,
    );
}

function editOwnSyncRowsQuery(extraWhere = '') {
  return `
    ${rankedBackupsCte}
    SELECT
      b.id as backup_id,
      l.id as listing_id,
      l.mobile_id,
      d.name as dealer_name,
      d.slug as dealer_slug,
      ${ownMakeExpr} as make,
      ${ownModelExpr} as model,
      ${ownTitleExpr} as title,
      ${ownPriceExpr} as current_price,
      ${ownEffectiveVatExpr} as vat,
      ${ownAdStatusExpr} as ad_status,
      ${ownKaparoExpr} as kaparo,
      l.title as source_title,
      l.current_price as source_price,
      l.vat as source_vat,
      l.ad_status as source_ad_status,
      l.kaparo as source_kaparo,
      ${ownNeedsSyncExpr} as needs_sync,
      CASE
        WHEN ${ownNeedsSyncExpr} = 0 AND b.last_mobile_sync_status = 'pending' THEN NULL
        ELSE b.last_mobile_sync_status
      END as last_mobile_sync_status,
      b.last_mobile_sync_error,
      b.last_mobile_sync_at
    FROM ranked_backups b
    JOIN listings l ON l.id = b.listing_id
    JOIN dealers d ON d.id = b.dealer_id
    WHERE b.row_num = 1 AND d.own = 1 AND d.active = 1${extraWhere}
    ORDER BY
      CASE WHEN ${ownNeedsSyncExpr} = 1 THEN 0 ELSE 1 END,
      COALESCE(b.updated_at, b.created_at) DESC,
      b.id DESC
  `;
}

export function getEditOwnSyncRows(): EditOwnSyncRow[] {
  return raw
    .prepare(editOwnSyncRowsQuery())
    .all() as EditOwnSyncRow[];
}

export function getPendingEditOwnSyncRows(): EditOwnSyncRow[] {
  return raw
    .prepare(editOwnSyncRowsQuery(` AND ${ownNeedsSyncExpr} = 1`))
    .all() as EditOwnSyncRow[];
}

export function countPendingEditOwnSyncRows(): number {
  const row = raw
    .prepare(
      `
    ${rankedBackupsCte}
    SELECT COUNT(*) as count
    FROM ranked_backups b
    JOIN listings l ON l.id = b.listing_id
    JOIN dealers d ON d.id = b.dealer_id
    WHERE b.row_num = 1 AND d.own = 1 AND d.active = 1 AND ${ownNeedsSyncExpr} = 1
  `,
    )
    .get() as { count: number };

  return row.count;
}

export function getMobileBgEditForms(limit = 100): MobileBgEditFormRow[] {
  return raw
    .prepare(
      `
    SELECT
      e.id, e.backup_id, e.listing_id, e.mobile_id, e.source_url, e.listing_token,
      e.row_title, e.row_price_text, e.form_url, e.screenshot_path, e.created_at,
      d.name as dealer_name, d.slug as dealer_slug,
      l.thumb_keys, l.full_keys, l.image_meta, l.images_downloaded, l.thumb_saved
    FROM mobilebg_edit_form_snapshots e
    LEFT JOIN dealers d ON e.dealer_id = d.id
    LEFT JOIN listings l ON e.listing_id = l.id
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT ?
  `,
    )
    .all(limit) as MobileBgEditFormRow[];
}

export function getMobileBgEditFormById(
  id: number,
): MobileBgEditFormDetailRow | null {
  const row = raw
    .prepare(
      `
    SELECT
      e.id, e.backup_id, e.listing_id, e.mobile_id, e.source_url, e.listing_token,
      e.row_title, e.row_price_text, e.form_url, e.screenshot_path, e.created_at,
      e.forms_json, e.fields_json, e.checked_boxes_json, e.checked_radios_json, e.hidden_json,
      d.name as dealer_name, d.slug as dealer_slug
    FROM mobilebg_edit_form_snapshots e
    LEFT JOIN dealers d ON e.dealer_id = d.id
    WHERE e.id = ?
  `,
    )
    .get(id) as MobileBgEditFormDetailRow | undefined;
  return row ?? null;
}

export function markStaleCrawlRunsInterrupted(): number {
  // Any run still 'running' is stale once the process restarts (job state is
  // in-memory only, so a live run cannot survive a restart).
  const res = raw
    .prepare(
      `UPDATE mobilebg_crawl_runs SET status = 'interrupted', finished_at = ? WHERE status = 'running'`,
    )
    .run(currentIsoTimestamp());
  return res.changes;
}

export function getMobileBgRepostJobs(limit = 100): MobileBgRepostJobRow[] {
  return raw
    .prepare(
      `
    SELECT
      r.id, r.backup_id, r.listing_id, r.source_mobile_id, r.target_mobile_id, r.status,
      r.message, r.preview_screenshot_path, r.debug_dir, r.started_at, r.finished_at, r.created_at,
      d.name as dealer_name, d.slug as dealer_slug,
      b.title as backup_title
    FROM mobilebg_repost_jobs r
    LEFT JOIN dealers d ON r.dealer_id = d.id
    LEFT JOIN mobilebg_backups b ON r.backup_id = b.id
    ORDER BY COALESCE(r.started_at, r.created_at) DESC, r.id DESC
    LIMIT ?
  `,
    )
    .all(limit) as MobileBgRepostJobRow[];
}
