export type CarsBgSyncStreamEntry =
  | { type: 'start'; message?: string; dryRun: boolean }
  | { type: 'dealer'; dealer: string; message?: string }
  | { type: 'summary'; dealer: string; missing: number; diffs: number; stale: number; dryRun: boolean }
  | { type: 'listing'; dealer: string; action: 'missing'; mobileId: string | null; carsId: string | null; make: string | null; model: string | null; title: string | null; price: number | null; url: string | null }
  | { type: 'diff'; dealer: string; action: 'price'; mobileId: string | null; carsId: string | null; make: string | null; model: string | null; title: string | null; oldPrice: number | null; newPrice: number | null; priceDiff?: boolean; titleDiff?: boolean; descriptionDiff?: boolean; oldTitle?: string | null; newTitle?: string | null; oldDescription?: string | null; newDescription?: string | null; url: string | null }
  | { type: 'stale'; dealer: string; carsId: string | null }
  | { type: 'done'; dealer: string; updated: number; created: number; deleted: number; failedUpdates: number; failedCreates: number; failedDeletes: number }
  | { type: 'end'; dryRun: boolean; missing: number; diffs: number; stale: number; updated: number; created: number; deleted: number; failedUpdates: number; failedCreates: number; failedDeletes: number; message?: string }
  | { type: 'log'; level?: 'stderr' | 'info'; dealer?: string; message?: string }
  | { type: 'error'; message?: string }
  | { type: 'stream_closed'; code?: number | null };

export interface MissingItem {
  dealer: string;
  mobileId: string | null;
  carsId: string | null;
  make: string | null;
  model: string | null;
  title: string | null;
  price: number | null;
  url: string | null;
}

export interface DiffItem {
  dealer: string;
  mobileId: string | null;
  carsId: string | null;
  make: string | null;
  model: string | null;
  title: string | null;
  oldPrice: number | null;
  newPrice: number | null;
  priceDiff?: boolean;
  titleDiff?: boolean;
  descriptionDiff?: boolean;
  oldTitle?: string | null;
  newTitle?: string | null;
  oldDescription?: string | null;
  newDescription?: string | null;
  url: string | null;
}

export interface CarsBgSyncTotals {
  missing: number;
  diffs: number;
  stale: number;
  updated: number;
  created: number;
  deleted: number;
  failedUpdates: number;
  failedCreates: number;
  failedDeletes: number;
}

export interface CarsBgSyncLogEntry {
  kind: 'status' | 'log' | 'error';
  message: string;
}
