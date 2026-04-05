import type { MobileBgSearchResultRow } from '@/lib/mobile-bg/search-results';

export function getEffectiveSortPrice(row: MobileBgSearchResultRow) {
  if (row.current_price == null) return null;
  if (row.vat_status === 'excluded') return row.current_price * 1.2;
  return row.current_price;
}

export function sortRowsByEffectivePrice(rows: MobileBgSearchResultRow[]) {
  return [...rows].sort((left, right) => {
    const leftPrice = getEffectiveSortPrice(left);
    const rightPrice = getEffectiveSortPrice(right);
    if (leftPrice == null && rightPrice == null) return left.original_position - right.original_position;
    if (leftPrice == null) return 1;
    if (rightPrice == null) return -1;
    if (leftPrice !== rightPrice) return leftPrice - rightPrice;
    return left.original_position - right.original_position;
  });
}

function toIgnoredSet(ignoredMobileIds: Iterable<string>) {
  return new Set(Array.from(ignoredMobileIds).filter(Boolean));
}

export function getOriginalPositionIgnoring(
  rows: MobileBgSearchResultRow[],
  mobileId: string,
  ignoredMobileIds: Iterable<string>,
) {
  const ignored = toIgnoredSet(ignoredMobileIds);
  const orderedRows = [...rows].sort((left, right) => left.original_position - right.original_position);
  let rank = 0;

  for (const row of orderedRows) {
    if (row.mobile_id === mobileId) return rank + 1;
    if (!ignored.has(row.mobile_id)) rank += 1;
  }

  return null;
}

export function getPriceSortedPositionIgnoring(
  rows: MobileBgSearchResultRow[],
  mobileId: string,
  ignoredMobileIds: Iterable<string>,
) {
  const ignored = toIgnoredSet(ignoredMobileIds);
  const sortedRows = sortRowsByEffectivePrice(rows);
  let rank = 0;

  for (const row of sortedRows) {
    if (row.mobile_id === mobileId) return rank + 1;
    if (!ignored.has(row.mobile_id)) rank += 1;
  }

  return null;
}

export function getFirstNonIgnoredResultPrice(
  rows: MobileBgSearchResultRow[],
  ignoredMobileIds: Iterable<string>,
) {
  const ignored = toIgnoredSet(ignoredMobileIds);
  const firstIncluded = rows.find((row) => !ignored.has(row.mobile_id));
  return firstIncluded?.current_price ?? null;
}
