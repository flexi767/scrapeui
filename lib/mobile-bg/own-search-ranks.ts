import { raw } from '@/db/client';
import { currentIsoTimestamp } from '@/lib/date-format';
import { buildFirstSevenSearchFields } from '@/lib/mobile-bg/search-form-shared';
import { getListingSearchPrefill } from '@/lib/mobile-bg/search-prefill';
import { fetchMobileBgSearchResultsUntilFound } from '@/lib/mobile-bg/search-results';
import { getIgnoredSearchResultMobileIds } from '@/lib/mobile-bg/search-ignores';
import { getFirstNonIgnoredResultPrice, getPriceSortedPositionIgnoring, getOriginalPositionIgnoring } from '@/lib/mobile-bg/search-ranking';
import { buildImageList, getPreferredListingThumbUrl, parseJson, type ImageMeta } from '@/lib/utils';
import { notDuplicateLExpr, rankedBackupsCte } from '@/lib/query-modules/types';

interface OwnSearchRankTarget {
  backup_id: number;
  listing_id: number;
  mobile_id: string | null;
  title: string | null;
  make: string | null;
  model: string | null;
  thumb_url: string | null;
  listing_url: string | null;
}

export interface OwnSearchRankProgressStats {
  total: number;
  checked: number;
  found: number;
  notFound: number;
}

export type OwnSearchRankProgressEvent =
  | {
      type: 'start';
      stats: OwnSearchRankProgressStats;
      missingOnly: boolean;
    }
  | {
      type: 'checking';
      stats: OwnSearchRankProgressStats;
      target: OwnSearchRankTarget;
    }
  | {
      type: 'result';
      stats: OwnSearchRankProgressStats;
      row: OwnSearchRankRunRow;
    }
  | {
      type: 'complete';
      stats: OwnSearchRankProgressStats;
      rows: OwnSearchRankRunRow[];
    };

export interface OwnSearchRankRunRow {
  backup_id: number;
  listing_id: number;
  mobile_id: string | null;
  title: string | null;
  make: string | null;
  model: string | null;
  checked_at: string;
  original_position: number | null;
  price_position: number | null;
  first_result_price: number | null;
  found: boolean;
  thumb_url: string | null;
  listing_url: string | null;
}

export interface OwnSearchRankRunSummary {
  total: number;
  found: number;
  notFound: number;
  rows: OwnSearchRankRunRow[];
}

interface RunOwnSearchRankChecksOptions {
  missingOnly?: boolean;
  onProgress?: (event: OwnSearchRankProgressEvent) => void;
}

function getOwnSearchRankTargets(missingOnly: boolean) {
  const whereExtras = missingOnly
    ? `AND (
        b.search_checked_at IS NULL
        OR b.search_original_position IS NULL
      )`
    : '';

  return raw.prepare(`
    ${rankedBackupsCte}
    SELECT
      b.id as backup_id,
      l.id as listing_id,
      l.mobile_id,
      COALESCE(b.title, l.title) as title,
      COALESCE(b.make, l.make) as make,
      COALESCE(b.model, l.model) as model,
      l.thumb_keys,
      l.full_keys,
      l.image_meta,
      l.images_downloaded,
      l.thumb_saved,
      (
        SELECT i.id
        FROM mobilebg_backup_images i
        JOIN mobilebg_backups ib ON ib.id = i.backup_id
        WHERE ib.listing_id = l.id
        ORDER BY i.sort_order ASC, i.id ASC
        LIMIT 1
      ) as first_backup_image_id
    FROM ranked_backups b
    JOIN listings l ON l.id = b.listing_id
    JOIN dealers d ON d.id = b.dealer_id
    WHERE
      b.row_num = 1
      AND d.own = 1
      AND d.active = 1
      AND l.is_active = 1
      AND ${notDuplicateLExpr}
      AND l.mobile_id IS NOT NULL
      ${whereExtras}
    ORDER BY d.priority DESC, d.name, COALESCE(b.make, l.make), COALESCE(b.model, l.model), l.mobile_id
  `).all() as Array<OwnSearchRankTarget & {
    thumb_keys: string | null;
    full_keys: string | null;
    image_meta: string | null;
    images_downloaded: number | null;
    thumb_saved: number | null;
    first_backup_image_id: number | null;
  }>;
}

function withPreview(targets: Array<OwnSearchRankTarget & {
  thumb_keys: string | null;
  full_keys: string | null;
  image_meta: string | null;
  images_downloaded: number | null;
  thumb_saved: number | null;
  first_backup_image_id: number | null;
}>): OwnSearchRankTarget[] {
  return targets.map((target) => {
    const thumbKeys = parseJson<string[]>(target.thumb_keys, []);
    const fullKeys = parseJson<string[]>(target.full_keys, []);
    const imageMeta = parseJson<ImageMeta | null>(target.image_meta, null);
    const images = target.mobile_id
      ? buildImageList(
          target.mobile_id,
          fullKeys.length ? fullKeys : thumbKeys,
          thumbKeys,
          imageMeta,
          target.images_downloaded === 1,
        )
      : [];

    return {
      backup_id: target.backup_id,
      listing_id: target.listing_id,
      mobile_id: target.mobile_id,
      title: target.title,
      make: target.make,
      model: target.model,
      thumb_url: target.first_backup_image_id
        ? `/api/mobilebg-backup-images/${target.first_backup_image_id}`
        : getPreferredListingThumbUrl(target.mobile_id, images[0]?.thumb, target.thumb_saved),
      listing_url: target.mobile_id ? `/listings/${target.mobile_id}` : null,
    };
  });
}

function saveOwnSearchRankResult(row: OwnSearchRankRunRow) {
  raw.prepare(`
    UPDATE mobilebg_backups
    SET
      search_checked_at = ?,
      search_original_position = ?,
      search_price_position = ?,
      search_first_result_price = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    row.checked_at,
    row.original_position,
    row.price_position,
    row.first_result_price,
    row.checked_at,
    row.backup_id,
  );
}

function buildProgressStats(total: number, rows: OwnSearchRankRunRow[]): OwnSearchRankProgressStats {
  const found = rows.filter((row) => row.found).length;
  return {
    total,
    checked: rows.length,
    found,
    notFound: rows.length - found,
  };
}

export async function runOwnSearchRankChecks(options: RunOwnSearchRankChecksOptions = {}): Promise<OwnSearchRankRunSummary> {
  const { missingOnly = false, onProgress } = options;
  const targets = withPreview(getOwnSearchRankTargets(missingOnly));
  const rows: OwnSearchRankRunRow[] = [];
  const total = targets.length;

  onProgress?.({
    type: 'start',
    stats: buildProgressStats(total, rows),
    missingOnly,
  });

  for (const target of targets) {
    const checkedAt = currentIsoTimestamp();

    onProgress?.({
      type: 'checking',
      stats: buildProgressStats(total, rows),
      target,
    });

    let result: OwnSearchRankRunRow;

    if (!target.mobile_id) {
      result = {
        backup_id: target.backup_id,
        listing_id: target.listing_id,
        mobile_id: target.mobile_id,
        title: target.title,
        make: target.make,
        model: target.model,
        checked_at: checkedAt,
        original_position: null,
        price_position: null,
        first_result_price: null,
        found: false,
        thumb_url: target.thumb_url,
        listing_url: target.listing_url,
      };
    } else {
      const prefill = await getListingSearchPrefill(target.listing_id, { includeLocationOptions: false });

      if (!prefill) {
        result = {
          backup_id: target.backup_id,
          listing_id: target.listing_id,
          mobile_id: target.mobile_id,
          title: target.title,
          make: target.make,
          model: target.model,
          checked_at: checkedAt,
          original_position: null,
          price_position: null,
          first_result_price: null,
          found: false,
          thumb_url: target.thumb_url,
          listing_url: target.listing_url,
        };
      } else {
        const searchFields = buildFirstSevenSearchFields(prefill.form.fields);
        const results = await fetchMobileBgSearchResultsUntilFound(
          prefill.form.action,
          prefill.form.method,
          searchFields,
          target.mobile_id,
        );
        const ignoredMobileIds = getIgnoredSearchResultMobileIds(target.listing_id);

        const matchedRow = results.rows.find((row) => row.mobile_id === target.mobile_id) ?? null;
        result = {
          backup_id: target.backup_id,
          listing_id: target.listing_id,
          mobile_id: target.mobile_id,
          title: target.title,
          make: target.make,
          model: target.model,
          checked_at: checkedAt,
          original_position: matchedRow ? getOriginalPositionIgnoring(results.rows, target.mobile_id, ignoredMobileIds) : null,
          price_position: matchedRow ? getPriceSortedPositionIgnoring(results.rows, target.mobile_id, ignoredMobileIds) : null,
          first_result_price: getFirstNonIgnoredResultPrice(results.rows, ignoredMobileIds),
          found: matchedRow != null,
          thumb_url: target.thumb_url,
          listing_url: target.listing_url,
        };
      }
    }

    saveOwnSearchRankResult(result);
    rows.push(result);
    onProgress?.({
      type: 'result',
      stats: buildProgressStats(total, rows),
      row: result,
    });
  }

  const stats = buildProgressStats(total, rows);
  onProgress?.({
    type: 'complete',
    stats,
    rows,
  });

  return {
    total: rows.length,
    found: stats.found,
    notFound: stats.notFound,
    rows,
  };
}
