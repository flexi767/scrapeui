import { raw } from '@/db/client';
import { type MobileBgSearchResultRow, fetchMobileBgSearchResultsUntilFound } from '@/lib/mobile-bg/search-results';
import { buildFirstSevenSearchFields, getListingSearchPrefill } from '@/lib/mobile-bg/search-prefill';

interface OwnSearchRankTarget {
  backup_id: number;
  listing_id: number;
  mobile_id: string | null;
  title: string | null;
  make: string | null;
  model: string | null;
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
    WITH ranked_backups AS (
      SELECT
        b.*,
        ROW_NUMBER() OVER (
          PARTITION BY b.dealer_id, b.mobile_id
          ORDER BY COALESCE(b.updated_at, b.created_at) DESC, b.id DESC
        ) as row_num
      FROM mobilebg_backups b
    )
    SELECT
      b.id as backup_id,
      l.id as listing_id,
      l.mobile_id,
      COALESCE(b.title, l.title) as title,
      COALESCE(b.make, l.make) as make,
      COALESCE(b.model, l.model) as model
    FROM ranked_backups b
    JOIN listings l ON l.id = b.listing_id
    JOIN dealers d ON d.id = b.dealer_id
    WHERE
      b.row_num = 1
      AND d.own = 1
      AND d.active = 1
      AND l.is_active = 1
      AND (l.duplicate = 0 OR l.duplicate IS NULL)
      AND l.mobile_id IS NOT NULL
      ${whereExtras}
    ORDER BY d.priority DESC, d.name, COALESCE(b.make, l.make), COALESCE(b.model, l.model), l.mobile_id
  `).all() as OwnSearchRankTarget[];
}

function getEffectiveSortPrice(row: MobileBgSearchResultRow) {
  if (row.current_price == null) return null;
  if (row.vat_status === 'excluded') return row.current_price * 1.2;
  return row.current_price;
}

function getPriceSortedPosition(rows: MobileBgSearchResultRow[], mobileId: string) {
  const sortedRows = [...rows].sort((left, right) => {
    const leftPrice = getEffectiveSortPrice(left);
    const rightPrice = getEffectiveSortPrice(right);
    if (leftPrice == null && rightPrice == null) return left.original_position - right.original_position;
    if (leftPrice == null) return 1;
    if (rightPrice == null) return -1;
    if (leftPrice !== rightPrice) return leftPrice - rightPrice;
    return left.original_position - right.original_position;
  });
  const index = sortedRows.findIndex((row) => row.mobile_id === mobileId);
  return index >= 0 ? index + 1 : null;
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
  const targets = getOwnSearchRankTargets(missingOnly);
  const rows: OwnSearchRankRunRow[] = [];
  const total = targets.length;

  onProgress?.({
    type: 'start',
    stats: buildProgressStats(total, rows),
    missingOnly,
  });

  for (const target of targets) {
    const checkedAt = new Date().toISOString();

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
        };
      } else {
        const searchFields = buildFirstSevenSearchFields(prefill.form.fields);
        const results = await fetchMobileBgSearchResultsUntilFound(
          prefill.form.action,
          prefill.form.method,
          searchFields,
          target.mobile_id,
        );

        const matchedRow = results.rows.find((row) => row.mobile_id === target.mobile_id) ?? null;
        result = {
          backup_id: target.backup_id,
          listing_id: target.listing_id,
          mobile_id: target.mobile_id,
          title: target.title,
          make: target.make,
          model: target.model,
          checked_at: checkedAt,
          original_position: matchedRow?.original_position ?? null,
          price_position: matchedRow ? getPriceSortedPosition(results.rows, target.mobile_id) : null,
          first_result_price: results.rows[0]?.current_price ?? null,
          found: matchedRow != null,
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
