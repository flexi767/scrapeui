import type Database from 'better-sqlite3';
import { currentIsoTimestamp } from '@/lib/date-format';
import { runUpdate } from '@/lib/listings/sql';
import { chromium, type Page } from 'playwright';
import { loginToCarsBg } from '@/lib/cars-bg/auth';
import {
  extractOfferId,
} from '@/lib/cars-bg/urls';
import {
  sanitizeCarsBgDescription,
} from '@/lib/cars-bg/sync-mapping';
import {
  createListing,
  deleteCarsBgOffer,
  updateListingContent,
  updateListingPrice,
} from '@/lib/cars-bg/sync-browser-actions';
import {
  applyCarsBgSyncedContent,
  getCarsBgTitleValue,
  planCarsBgDealerSync,
  type CarsBgDiff,
  type CarsBgSyncPlan,
} from '@/lib/cars-bg/sync-plan';

export {
  buildCarsBgEditUrl,
  buildCarsBgOfferUrl,
  extractMobileIdFromUrl,
  extractOfferId,
} from '@/lib/cars-bg/urls';
export {
  applyCarsBgSyncedContent,
  getCarsBgTitleValue,
  getStaleCarsBgListings,
  planCarsBgDealerSync,
  type CarsBgDiff,
  type CarsBgSyncListing,
  type CarsBgSyncPlan,
} from '@/lib/cars-bg/sync-plan';

export interface CarsBgDealerAccount {
  id: number;
  slug: string;
  name: string | null;
  carsUrl: string | null;
  carsUser: string | null;
  carsPassword: string | null;
}

export interface CarsBgSyncDealerResult extends CarsBgSyncPlan {
  updated: number;
  created: number;
  deleted: number;
  failedUpdates: number;
  failedCreates: number;
  failedDeletes: number;
  dryRun: boolean;
}

export function saveCarsId(db: Database.Database, mobileId: string, carsId: string): void {
  const now = currentIsoTimestamp();
  runUpdate(
    db,
    'listings',
    { cars_id: carsId, cars_synced_at: now },
    { sql: 'mobile_id = ?', params: [mobileId] },
  );
}

export function clearCarsId(db: Database.Database, carsId: string): void {
  const now = currentIsoTimestamp();
  runUpdate(
    db,
    'listings',
    { cars_id: null, cars_synced_at: now },
    { sql: 'cars_id = ?', params: [carsId] },
  );
}

async function syncCarsBgDiff(
  db: Database.Database,
  page: Page,
  diff: CarsBgDiff,
  logger: (message: string) => void,
): Promise<boolean> {
  const targetId = diff.mobileBg.carsId || diff.carsBg.carsId || extractOfferId(diff.carsBg.url);
  if (!targetId) return false;

  const updateParts: string[] = [];
  let ok = true;

  if (diff.priceDiff && diff.mobileBg.price.amount != null) {
    updateParts.push(`price €${diff.carsBg.price.amount ?? '—'} -> €${diff.mobileBg.price.amount}`);
    ok = ok && await updateListingPrice(page, targetId, diff.mobileBg);
  }

  let contentUpdated = false;
  if (diff.titleDiff || diff.descriptionDiff) {
    const changedFields = [
      diff.titleDiff ? 'title' : null,
      diff.descriptionDiff ? 'description' : null,
    ].filter(Boolean).join('/');
    updateParts.push(changedFields);
    contentUpdated = await updateListingContent(page, targetId, diff.mobileBg);
    ok = ok && contentUpdated;
  }

  logger(`Updating cars.bg ${updateParts.join(', ')} for ${diff.mobileBg.fullTitle}`);

  if (!diff.mobileBg.carsId && targetId && diff.mobileBg.mobileId) {
    saveCarsId(db, diff.mobileBg.mobileId, targetId);
  }
  if (diff.priceDiff) {
    applyCarsBgSyncedContent(db, diff.carsBg.id, {
      price: diff.mobileBg.price.amount ?? null,
    });
  }
  if (contentUpdated) {
    applyCarsBgSyncedContent(db, diff.carsBg.id, {
      title: diff.titleDiff ? (getCarsBgTitleValue(diff.mobileBg) || null) : undefined,
      description: diff.descriptionDiff
        ? (sanitizeCarsBgDescription(diff.mobileBg.description || diff.mobileBg.fullTitle) || null)
        : undefined,
    });
  }

  return ok;
}

export async function syncCarsBgDealer(
  db: Database.Database,
  dealer: CarsBgDealerAccount,
  options?: {
    dryRun?: boolean;
    logger?: (message: string) => void;
  },
): Promise<CarsBgSyncDealerResult> {
  const logger = options?.logger ?? (() => {});
  const plan = await planCarsBgDealerSync(db, dealer);

  logger(`Cars.bg sync plan for ${dealer.slug}: ${plan.missing.length} missing, ${plan.diffs.length} diffs, ${plan.staleCarsIds.length} stale`);

  const result: CarsBgSyncDealerResult = {
    ...plan,
    updated: 0,
    created: 0,
    deleted: 0,
    failedUpdates: 0,
    failedCreates: 0,
    failedDeletes: 0,
    dryRun: options?.dryRun !== false,
  };

  if (result.dryRun || (!plan.missing.length && !plan.diffs.length && !plan.staleCarsIds.length)) {
    return result;
  }

  if (!dealer.carsUser || !dealer.carsPassword) {
    throw new Error(`Dealer ${dealer.slug} is missing cars.bg credentials`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const loggedIn = await loginToCarsBg(page, dealer.carsUser, dealer.carsPassword);
    if (!loggedIn) throw new Error(`Cars.bg login failed for ${dealer.slug}`);

    for (const diff of plan.diffs) {
      if (await syncCarsBgDiff(db, page, diff, logger)) {
        result.updated++;
      } else {
        result.failedUpdates++;
      }
    }

    for (const carsId of plan.staleCarsIds) {
      logger(`Deleting stale cars.bg offer ${carsId}`);
      const deleted = await deleteCarsBgOffer(page, carsId);
      if (deleted) {
        clearCarsId(db, carsId);
        result.deleted++;
      } else {
        result.failedDeletes++;
      }
    }

    for (const listing of plan.missing) {
      logger(`Publishing missing cars.bg listing ${listing.fullTitle}`);
      const created = await createListing(page, listing, dealer.slug);
      if (created.success && created.offerId && listing.mobileId) {
        saveCarsId(db, listing.mobileId, created.offerId);
        result.created++;
      } else {
        result.failedCreates++;
      }
    }
  } finally {
    await browser.close();
  }

  return result;
}
