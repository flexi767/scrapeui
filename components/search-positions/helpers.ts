import type { RankRow, RankTarget, SearchPositionLogEntry, SearchPositionStreamEntry, SearchPositionSummary } from '@/components/search-positions/types';

export function labelForTarget(target: RankTarget) {
  return [target.make, target.model, target.title].filter(Boolean).join(' ') || target.mobile_id || `listing ${target.listing_id}`;
}

export function labelForRow(row: RankRow) {
  return [row.make, row.model, row.title].filter(Boolean).join(' ') || row.mobile_id || `listing ${row.listing_id}`;
}

export function logEntryFromResult(row: RankRow): SearchPositionLogEntry {
  return {
    kind: 'result',
    found: row.found,
    message: labelForRow(row),
    thumbUrl: row.thumb_url,
    listingUrl: row.listing_url,
    originalPosition: row.original_position,
    pricePosition: row.price_position,
  };
}

export function summaryFromCompleteEvent(event: Extract<SearchPositionStreamEntry, { type: 'complete' }>): SearchPositionSummary {
  return {
    total: event.total,
    found: event.found,
    notFound: event.notFound,
  };
}
