import type { CarsBgSyncTotals } from '@/components/cars-bg-sync/types';

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
