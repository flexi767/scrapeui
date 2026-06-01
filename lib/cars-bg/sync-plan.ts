import type Database from 'better-sqlite3';
import {
  normalizeLabel,
  normalizeCompareText,
  sanitizeCarsBgTitle,
} from '@/lib/cars-bg/sync-mapping';
import {
  loadDealerCarsSyncListings,
  loadDealerMobileSyncListings,
} from '@/lib/cars-bg/sync-listings';
import { scoreCarsBgComparableMatch } from '@/lib/cars-bg/matching';
import type {
  CarsBgDiff,
  CarsBgSyncDealerIdentity,
  CarsBgSyncListing,
  CarsBgSyncPlan,
} from '@/lib/cars-bg/sync-types';

export type {
  CarsBgDiff,
  CarsBgSyncDealerIdentity,
  CarsBgSyncListing,
  CarsBgSyncPlan,
} from '@/lib/cars-bg/sync-types';

export function applyCarsBgSyncedContent(
  db: Database.Database,
  listingId: number,
  content: { title?: string | null; description?: string | null; price?: number | null },
): void {
  const assignments: string[] = [];
  const values: unknown[] = [];
  if (content.price !== undefined) {
    assignments.push('current_price = ?');
    values.push(content.price ?? null);
  }
  if (content.title !== undefined) {
    assignments.push('carsbg_title = ?');
    values.push(content.title ?? null);
  }
  if (content.description !== undefined) {
    assignments.push('description = ?');
    values.push(content.description ?? null);
  }
  if (!assignments.length) return;
  values.push(listingId);
  db.prepare(`UPDATE listings SET ${assignments.join(', ')} WHERE id = ?`).run(...values);
}

export function getStaleCarsBgListings(db: Database.Database, dealerSlug: string): string[] {
  const rows = db.prepare(`
    SELECT l.cars_id
    FROM listings l
    JOIN dealers d ON d.id = l.dealer_id
    WHERE d.slug = ?
      AND l.source = 'm'
      AND l.is_active = 0
      AND l.cars_id IS NOT NULL
  `).all(dealerSlug) as { cars_id: string }[];
  return rows.map((row) => row.cars_id).filter(Boolean);
}

export function getCarsBgTitleValue(listing: CarsBgSyncListing): string {
  return sanitizeCarsBgTitle(listing.carsbgTitle || listing.title || listing.fullTitle || '');
}

function compareListings(mobile: CarsBgSyncListing[], cars: CarsBgSyncListing[]): CarsBgSyncPlan {
  const missing: CarsBgSyncListing[] = [];
  const diffs: CarsBgDiff[] = [];
  const matchedCars = new Set<number>();
  const carsById = new Map(cars.filter((entry) => entry.carsId).map((entry) => [entry.carsId!, entry]));

  for (const mobileListing of mobile) {
    let match: CarsBgSyncListing | null = null;

    if (mobileListing.carsId) {
      match = carsById.get(mobileListing.carsId) ?? null;
      if (match) {
        matchedCars.add(match.id);
      } else {
        continue;
      }
    }

    if (!match) {
      let best: { listing: CarsBgSyncListing; score: number } | null = null;

      for (const carsListing of cars) {
        if (matchedCars.has(carsListing.id)) continue;

        const score = scoreCarsBgComparableMatch(mobileListing, carsListing);
        if (score == null) continue;

        if (!best || score > best.score) best = { listing: carsListing, score };
      }

      if (best && best.score >= 4) {
        match = best.listing;
        matchedCars.add(match.id);
      }
    }

    if (!match) {
      missing.push(mobileListing);
      continue;
    }

    const priceDiff = mobileListing.price.amount != null
      && match.price.amount != null
      && Number(mobileListing.price.amount) !== Number(match.price.amount);
    const targetTitle = getCarsBgTitleValue(mobileListing);
    const currentCarsTitle = getCarsBgTitleValue(match);
    const titleDiff = Boolean(
      targetTitle &&
      normalizeLabel(targetTitle) !== normalizeLabel(currentCarsTitle),
    );
    const targetDescription = normalizeCompareText(mobileListing.description);
    const currentDescription = normalizeCompareText(match.description);
    const descriptionDiff = Boolean(
      targetDescription &&
      currentDescription &&
      targetDescription !== currentDescription,
    );

    if (priceDiff || titleDiff || descriptionDiff) {
      diffs.push({ mobileBg: mobileListing, carsBg: match, priceDiff, titleDiff, descriptionDiff });
    }
  }

  return {
    missing,
    diffs,
    staleCarsIds: [],
  };
}

export async function planCarsBgDealerSync(
  db: Database.Database,
  dealer: CarsBgSyncDealerIdentity,
): Promise<CarsBgSyncPlan> {
  const mobileListings = loadDealerMobileSyncListings(db, dealer.id);
  const carsListings = loadDealerCarsSyncListings(db, dealer.id);
  const plan = compareListings(mobileListings, carsListings);
  plan.staleCarsIds = getStaleCarsBgListings(db, dealer.slug);
  return plan;
}
