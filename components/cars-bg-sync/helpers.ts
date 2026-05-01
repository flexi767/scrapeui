import type { CarsBgSyncStreamEntry, CarsBgSyncTotals, DiffItem, MissingItem, StaleCarsItem } from '@/components/cars-bg-sync/types';

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
