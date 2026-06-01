import { currentIsoTimestamp } from '@/lib/date-format';
import { buildFirstSevenSearchFields } from '@/lib/mobile-bg/search-form-shared';
import { getListingSearchPrefill } from '@/lib/mobile-bg/search-prefill';
import { fetchMobileBgSearchResultsUntilFound } from '@/lib/mobile-bg/search-results';
import { getIgnoredSearchResultMobileIds } from '@/lib/mobile-bg/search-ignores';
import { getFirstNonIgnoredResultPrice, getPriceSortedPositionIgnoring, getOriginalPositionIgnoring } from '@/lib/mobile-bg/search-ranking';
import { raw } from '@/db/client';
import {
  getOwnSearchRankTargets,
  type OwnSearchRankTarget,
} from '@/lib/mobile-bg/own-search-rank-targets';

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

function buildNotFoundRow(target: OwnSearchRankTarget, checkedAt: string): OwnSearchRankRunRow {
  return {
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
}

export async function runOwnSearchRankChecks(options: RunOwnSearchRankChecksOptions = {}): Promise<OwnSearchRankRunSummary> {
  const { missingOnly = false, onProgress } = options;
  const targets = getOwnSearchRankTargets(missingOnly);
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
      result = buildNotFoundRow(target, checkedAt);
    } else {
      const prefill = await getListingSearchPrefill(target.listing_id, { includeLocationOptions: false });

      if (!prefill) {
        result = buildNotFoundRow(target, checkedAt);
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
