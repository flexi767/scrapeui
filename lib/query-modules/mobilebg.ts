import { raw } from '@/db/client';
import type { EditOwnSyncRow, MakeModelMappingRow, MobileBgDashboardSummary, MobileBgEditFormDetailRow, MobileBgEditFormRow, MobileBgCrawlRunRow, MobileBgRepostJobRow } from './types';
import { latestBackupOrderExpr, ownNeedsSyncExpr, ownVatExpr, rankedBackupsCte } from './types';
import type { MobileBgDealerRow } from '@/lib/mobile-bg/constants';

export function getMobileBgDealerBySlug(slug: string): MobileBgDealerRow | undefined {
  return raw.prepare(`
    SELECT id, slug, name, mobile_user, mobile_password
    FROM dealers
    WHERE slug = ?
  `).get(slug) as MobileBgDealerRow | undefined;
}

export function getMakeModelMappings(limit = 500): MakeModelMappingRow[] {
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
  `,
    )
    .all(limit) as MakeModelMappingRow[];
}

export function getMobileBgDashboardSummary(): MobileBgDashboardSummary {
  const crawlRuns = raw
    .prepare(`SELECT COUNT(*) as count FROM mobilebg_crawl_runs`)
    .get() as { count: number };
  const backups = raw
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM (
      SELECT 1
      FROM mobilebg_backups
      GROUP BY dealer_id, mobile_id
    )
  `,
    )
    .get() as { count: number };
  const editForms = raw
    .prepare(`SELECT COUNT(*) as count FROM mobilebg_edit_form_snapshots`)
    .get() as { count: number };
  const repostJobs = raw
    .prepare(`SELECT COUNT(*) as count FROM mobilebg_repost_jobs`)
    .get() as { count: number };
  return {
    crawlRuns: crawlRuns.count,
    backups: backups.count,
    editForms: editForms.count,
    repostJobs: repostJobs.count,
  };
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
  const now = new Date().toISOString();
  const result = raw
    .prepare(
      `
    INSERT INTO mobilebg_crawl_runs (dealer_id, source_url, status, started_at, created_at, updated_at)
    VALUES (?, ?, 'running', ?, ?, ?)
  `,
    )
    .run(dealerId, sourceUrl, now, now, now);
  return result.lastInsertRowid as number;
}

export function updateCrawlRun(
  runId: number,
  data: {
    status: 'completed' | 'failed';
    listingsCount: number;
    imagesDownloaded: number;
    imagesFailed: number;
  },
): void {
  const now = new Date().toISOString();
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


export function getEditOwnSyncRows(): EditOwnSyncRow[] {
  return raw
    .prepare(
      `
    ${rankedBackupsCte}
    SELECT
      b.id as backup_id,
      l.id as listing_id,
      l.mobile_id,
      d.name as dealer_name,
      d.slug as dealer_slug,
      COALESCE(b.make, l.make) as make,
      COALESCE(b.model, l.model) as model,
      COALESCE(b.title, l.title) as title,
      COALESCE(b.price_amount, l.current_price) as current_price,
      ${ownVatExpr} as vat,
      COALESCE(b.ad_status, l.ad_status) as ad_status,
      COALESCE(b.kaparo, l.kaparo) as kaparo,
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
    WHERE b.row_num = 1 AND d.own = 1 AND d.active = 1
    ORDER BY
      CASE WHEN ${ownNeedsSyncExpr} = 1 THEN 0 ELSE 1 END,
      COALESCE(b.updated_at, b.created_at) DESC,
      b.id DESC
  `,
    )
    .all() as EditOwnSyncRow[];
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

export interface MobileBgCrawlQueueRow {
  id: number;
  dealer_id: number;
  url: string;
  url_type: string;
  mobile_id: string | null;
  status: string;
  listings_count: number | null;
  price: number | null;
  views: number | null;
  last_crawled_at: string | null;
  next_crawl_at: string | null;
  error: string | null;
  created_at: string | null;
  updated_at: string | null;
  dealer_name: string | null;
  dealer_slug: string | null;
}

export interface MobileBgCrawlQueueFilters {
  dealer?: string | string[];
  urlType?: string | string[];
  status?: string | string[];
  search?: string;
  page?: number;
  limit?: number;
}

export function getMobileBgCrawlQueue(filters: MobileBgCrawlQueueFilters = {}) {
  const {
    dealer = "",
    urlType = "",
    status = "",
    search = "",
    page = 1,
    limit = 50,
  } = filters;

  const dealerSlugs = Array.isArray(dealer) ? dealer : dealer ? [dealer] : [];
  const urlTypes = Array.isArray(urlType) ? urlType : urlType ? [urlType] : [];
  const statuses = Array.isArray(status) ? status : status ? [status] : [];
  const wheres: string[] = [];
  const params: (string | number)[] = [];

  if (dealerSlugs.length > 0) {
    const ph = dealerSlugs.map(() => "?").join(",");
    wheres.push(`d.slug IN (${ph})`);
    params.push(...dealerSlugs);
  }
  if (urlTypes.length > 0) {
    const ph = urlTypes.map(() => "?").join(",");
    wheres.push(`c.url_type IN (${ph})`);
    params.push(...urlTypes);
  }
  if (statuses.length > 0) {
    const ph = statuses.map(() => "?").join(",");
    wheres.push(`c.status IN (${ph})`);
    params.push(...statuses);
  }
  if (search) {
    wheres.push("(c.url LIKE ? OR c.mobile_id LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  const where = wheres.length ? `WHERE ${wheres.join(" AND ")}` : "";
  const offset = (page - 1) * limit;

  const rows = raw
    .prepare(
      `
    SELECT
      c.id, c.dealer_id, c.url, c.url_type, c.mobile_id, c.status,
      c.listings_count, c.price, c.views, c.last_crawled_at, c.next_crawl_at, c.error,
      c.created_at, c.updated_at,
      d.name as dealer_name, d.slug as dealer_slug
    FROM mobilebg_crawl_queue c
    LEFT JOIN dealers d ON c.dealer_id = d.id
    ${where}
    ORDER BY c.last_crawled_at DESC NULLS LAST, c.created_at DESC, c.id DESC
    LIMIT ? OFFSET ?
  `,
    )
    .all(...params, limit, offset) as MobileBgCrawlQueueRow[];

  const { count } = raw
    .prepare(
      `
    SELECT COUNT(*) as count
    FROM mobilebg_crawl_queue c
    LEFT JOIN dealers d ON c.dealer_id = d.id
    ${where}
  `,
    )
    .get(...params) as { count: number };

  return { data: rows, total: count, page, limit };
}
