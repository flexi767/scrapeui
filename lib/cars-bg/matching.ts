import type Database from 'better-sqlite3';
import {
  modelsLookEquivalent,
  titleOverlapScore,
} from '@/lib/cars-bg/parse';
import {
  normalizeFuelFamily,
  normalizeLabel,
} from '@/lib/cars-bg/sync-mapping';

export interface MobileDuplicateCandidate {
  id: number;
  mobile_id: string | null;
  title: string | null;
  model: string | null;
  reg_year: string | null;
  mileage: number | null;
  fuel: string | null;
  body_type: string | null;
  current_price: number | null;
  cars_total_views?: number | null;
}

export interface DuplicateProbe {
  title?: string | null;
  year?: string | null;
  mileage?: number | null;
  fuel?: string | null;
  bodyType?: string | null;
}

export interface CarsBgComparableListing {
  id: number;
  fullTitle: string;
  make: string | null;
  model: string | null;
  year: string | null;
  mileage: number | null;
  fuel: string | null;
  category: string | null;
  price: { amount: number | null };
}

export function findMatchingMobileListing(
  db: Database.Database,
  dealerId: number,
  listing: DuplicateProbe,
  make: string | null,
  model: string | null,
): MobileDuplicateCandidate | null {
  if (!make || !model) return null;
  const candidates = db.prepare(`
    SELECT id, mobile_id, title, model, reg_year, mileage, fuel, body_type, current_price, cars_total_views
    FROM listings
    WHERE source = 'm' AND dealer_id = ? AND make = ? AND is_active = 1
  `).all(dealerId, make) as MobileDuplicateCandidate[];

  let best: { row: MobileDuplicateCandidate; score: number } | null = null;

  for (const row of candidates) {
    let score = 0;
    if (!modelsLookEquivalent(model, row.model)) continue;
    score += 3;

    if (listing.year && row.reg_year) {
      if (String(listing.year) !== String(row.reg_year)) continue;
      score += 4;
    }

    if (listing.mileage != null && row.mileage != null) {
      const diff = Math.abs(Number(listing.mileage) - Number(row.mileage));
      if (diff === 0) score += 5;
      else if (diff <= 1000) score += 4;
      else if (diff <= 5000) score += 2;
      else continue;
    }

    if (listing.fuel && row.fuel && String(listing.fuel) === String(row.fuel)) score += 2;
    if (listing.bodyType && row.body_type && String(listing.bodyType) === String(row.body_type)) score += 1;
    if (listing.title && row.title) score += Math.min(2, titleOverlapScore(listing.title, row.title));

    if (best == null || score > best.score) best = { row, score };
  }

  return best && best.score >= 5 ? best.row : null;
}

export function scoreCarsBgComparableMatch(
  mobileListing: CarsBgComparableListing,
  carsListing: CarsBgComparableListing,
): number | null {
  let score = 0;
  const mobileMake = normalizeLabel(mobileListing.make || '');
  const carsMake = normalizeLabel(carsListing.make || '');
  const mobileModel = normalizeLabel(mobileListing.model || '');
  const carsModel = normalizeLabel(carsListing.model || '');
  const carsFull = normalizeLabel(carsListing.fullTitle);
  const mobileFull = normalizeLabel(mobileListing.fullTitle);

  if (mobileMake && carsMake) {
    if (mobileMake === carsMake) score += 2;
    else if (carsFull.includes(mobileMake) || mobileFull.includes(carsMake)) score += 1;
    else score -= 2;
  }

  if (mobileModel && carsModel) {
    if (mobileModel === carsModel) score += 2;
    else if (carsFull.includes(mobileModel) || mobileFull.includes(carsModel)) score += 1;
    else score -= 3;
  }

  if (mobileListing.price.amount != null && carsListing.price.amount != null) {
    if (Number(mobileListing.price.amount) === Number(carsListing.price.amount)) score += 2;
    else if (Math.abs(Number(mobileListing.price.amount) - Number(carsListing.price.amount)) <= 500) {
      score += 1;
    }
  }

  if (mobileListing.year && carsListing.year) {
    if (mobileListing.year === carsListing.year) score += 2;
    else return null;
  }

  if (mobileListing.mileage != null && carsListing.mileage != null) {
    const diff = Math.abs(Number(mobileListing.mileage) - Number(carsListing.mileage));
    if (diff === 0) score += 3;
    else if (diff <= 1000) score += 2;
    else if (diff <= 5000) score += 1;
    else return null;
  }

  if (mobileListing.fuel && carsListing.fuel) {
    const mobileFuelFamily = normalizeFuelFamily(mobileListing.fuel);
    const carsFuelFamily = normalizeFuelFamily(carsListing.fuel);
    if (mobileFuelFamily && carsFuelFamily && mobileFuelFamily === carsFuelFamily) score += 1;
    else return null;
  }

  if (mobileListing.category && carsListing.category && mobileListing.category === carsListing.category) {
    score += 1;
  }

  return score + Math.min(1, titleOverlapScore(mobileListing.fullTitle, carsListing.fullTitle));
}

