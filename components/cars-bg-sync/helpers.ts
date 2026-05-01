import type { CarsBgSyncLogEntry, CarsBgSyncStreamEntry, CarsBgSyncTotals, DiffItem, MissingItem, StaleCarsItem } from '@/components/cars-bg-sync/types';

export const ZERO_CARS_BG_SYNC_TOTALS: CarsBgSyncTotals = {
  missing: 0,
  diffs: 0,
  stale: 0,
  updated: 0,
  created: 0,
  deleted: 0,
  failedUpdates: 0,
  failedCreates: 0,
  failedDeletes: 0,
};

export function listingLabel(item: { make: string | null; model: string | null; title: string | null; mobileId?: string | null; carsId?: string | null }) {
  return [item.make, item.model, item.title].filter(Boolean).join(' ') || item.mobileId || item.carsId || 'Listing';
}

export function addSummaryTotals(totals: CarsBgSyncTotals, event: Extract<CarsBgSyncStreamEntry, { type: 'summary' }>): CarsBgSyncTotals {
  return {
    ...totals,
    missing: totals.missing + event.missing,
    diffs: totals.diffs + event.diffs,
    stale: totals.stale + event.stale,
  };
}

export function addDoneTotals(totals: CarsBgSyncTotals, event: Extract<CarsBgSyncStreamEntry, { type: 'done' }>): CarsBgSyncTotals {
  return {
    ...totals,
    updated: totals.updated + event.updated,
    created: totals.created + event.created,
    deleted: totals.deleted + event.deleted,
    failedUpdates: totals.failedUpdates + event.failedUpdates,
    failedCreates: totals.failedCreates + event.failedCreates,
    failedDeletes: totals.failedDeletes + event.failedDeletes,
  };
}

export function summaryLogFromEvent(event: Extract<CarsBgSyncStreamEntry, { type: 'summary' }>): CarsBgSyncLogEntry {
  return {
    kind: 'status',
    message: `${event.dealer}: ${event.missing} missing, ${event.diffs} diffs, ${event.stale} stale`,
  };
}

export function doneLogFromEvent(event: Extract<CarsBgSyncStreamEntry, { type: 'done' }>): CarsBgSyncLogEntry {
  return {
    kind: 'status',
    message: `${event.dealer}: ${event.updated} updated, ${event.created} created, ${event.deleted} deleted`,
  };
}

export function streamLogFromEvent(event: Extract<CarsBgSyncStreamEntry, { type: 'log' }>): CarsBgSyncLogEntry | null {
  if (!event.message) return null;
  return {
    kind: event.level === 'stderr' ? 'error' : 'log',
    message: event.dealer ? `${event.dealer}: ${event.message}` : event.message,
  };
}

export function totalsFromEndEvent(event: Extract<CarsBgSyncStreamEntry, { type: 'end' }>): CarsBgSyncTotals {
  return {
    missing: event.missing,
    diffs: event.diffs,
    stale: event.stale,
    updated: event.updated,
    created: event.created,
    deleted: event.deleted,
    failedUpdates: event.failedUpdates,
    failedCreates: event.failedCreates,
    failedDeletes: event.failedDeletes,
  };
}

export function missingItemFromEvent(event: Extract<CarsBgSyncStreamEntry, { type: 'listing' }>): MissingItem {
  return {
    dealer: event.dealer,
    mobileId: event.mobileId,
    carsId: event.carsId,
    make: event.make,
    model: event.model,
    title: event.title,
    price: event.price,
    url: event.url,
  };
}

export function diffItemFromEvent(event: Extract<CarsBgSyncStreamEntry, { type: 'diff' }>): DiffItem {
  return {
    dealer: event.dealer,
    mobileId: event.mobileId,
    carsId: event.carsId,
    make: event.make,
    model: event.model,
    title: event.title,
    oldPrice: event.oldPrice,
    newPrice: event.newPrice,
    priceDiff: event.priceDiff,
    titleDiff: event.titleDiff,
    descriptionDiff: event.descriptionDiff,
    oldTitle: event.oldTitle ?? null,
    newTitle: event.newTitle ?? null,
    oldDescription: event.oldDescription ?? null,
    newDescription: event.newDescription ?? null,
    url: event.url,
  };
}

export function staleItemFromEvent(event: Extract<CarsBgSyncStreamEntry, { type: 'stale' }>): StaleCarsItem {
  return {
    dealer: event.dealer,
    carsId: event.carsId,
  };
}
