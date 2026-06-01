import type { CarsBgExtrasPayload } from '@/lib/cars-bg/sync-mapping';

export interface CarsBgSyncListing {
  id: number;
  mobileId: string | null;
  carsId: string | null;
  url: string;
  title: string;
  carsbgTitle: string | null;
  fullTitle: string;
  make: string | null;
  model: string | null;
  year: string | null;
  month: string | null;
  fuel: string | null;
  category: string | null;
  transmission: string | null;
  color: string | null;
  euronorm: number | null;
  power: number | null;
  mileage: number | null;
  description: string | null;
  adStatus: string;
  kaparo: boolean;
  vat: string | null;
  price: { amount: number | null; currency: 'EUR' };
  images: string[];
  carsBgExtras: CarsBgExtrasPayload | null;
  extraLabels: string[];
}

export interface CarsBgDiff {
  mobileBg: CarsBgSyncListing;
  carsBg: CarsBgSyncListing;
  priceDiff: boolean;
  titleDiff: boolean;
  descriptionDiff: boolean;
}

export interface CarsBgSyncPlan {
  missing: CarsBgSyncListing[];
  diffs: CarsBgDiff[];
  staleCarsIds: string[];
}

export interface CarsBgSyncDealerIdentity {
  id: number;
  slug: string;
}
