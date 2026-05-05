#!/usr/bin/env tsx
import Database from 'better-sqlite3';
import {
  planCarsBgDealerSync,
  syncCarsBgDealer,
  type CarsBgDealerAccount,
} from '@/lib/cars-bg/sync';
import { emit, formatError, parseRunnerArgs, DB_PATH } from '@/scraper/lib/runner';

const { requestedSlugs } = parseRunnerArgs();
const dryRun = !process.argv.includes('--live');

function loadDealers(db: Database.Database): CarsBgDealerAccount[] {
  const rows = db.prepare(`
    SELECT id, slug, name, cars_url, cars_user, cars_password
    FROM dealers
    WHERE active = 1
      AND own = 1
      AND cars_user IS NOT NULL
      AND cars_password IS NOT NULL
      AND TRIM(COALESCE(cars_user, '')) != ''
      AND TRIM(COALESCE(cars_password, '')) != ''
      ${requestedSlugs.length ? `AND slug IN (${requestedSlugs.map(() => '?').join(', ')})` : ''}
    ORDER BY priority DESC, slug
  `).all(...requestedSlugs) as {
    id: number;
    slug: string;
    name: string | null;
    cars_url: string | null;
    cars_user: string | null;
    cars_password: string | null;
  }[];

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    carsUrl: row.cars_url,
    carsUser: row.cars_user,
    carsPassword: row.cars_password,
  }));
}

async function main() {
  const db = new Database(DB_PATH);

  try {
    const dealers = loadDealers(db);
    if (dealers.length === 0) {
      emit({ type: 'error', message: 'No own dealers with cars.bg credentials found' });
      process.exitCode = 1;
      return;
    }

    emit({
      type: 'start',
      message: `${dryRun ? 'Planning' : 'Running'} Cars.bg sync for ${dealers.map((dealer) => dealer.slug).join(', ')}`,
      dryRun,
    });

    const totals = {
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

    for (const dealer of dealers) {
      emit({ type: 'dealer', dealer: dealer.slug, message: `${dryRun ? 'Planning' : 'Syncing'} ${dealer.slug}` });
      const plan = await planCarsBgDealerSync(db, dealer);

      totals.missing += plan.missing.length;
      totals.diffs += plan.diffs.length;
      totals.stale += plan.staleCarsIds.length;

      emit({
        type: 'summary',
        dealer: dealer.slug,
        missing: plan.missing.length,
        diffs: plan.diffs.length,
        stale: plan.staleCarsIds.length,
        dryRun,
      });

      for (const listing of plan.missing) {
        emit({
          type: 'listing',
          dealer: dealer.slug,
          action: 'missing',
          mobileId: listing.mobileId,
          carsId: listing.carsId,
          make: listing.make,
          model: listing.model,
          title: listing.title,
          price: listing.price.amount,
          url: listing.url,
        });
      }

      for (const diff of plan.diffs) {
        emit({
          type: 'diff',
          dealer: dealer.slug,
          action: 'price',
          mobileId: diff.mobileBg.mobileId,
          carsId: diff.mobileBg.carsId || diff.carsBg.carsId,
          make: diff.mobileBg.make,
          model: diff.mobileBg.model,
          title: diff.mobileBg.title,
          oldPrice: diff.carsBg.price.amount,
          newPrice: diff.mobileBg.price.amount,
          priceDiff: diff.priceDiff,
          titleDiff: diff.titleDiff,
          descriptionDiff: diff.descriptionDiff,
          oldTitle: diff.carsBg.carsbgTitle || diff.carsBg.title || null,
          newTitle: diff.mobileBg.carsbgTitle || diff.mobileBg.title || null,
          oldDescription: diff.carsBg.description ?? null,
          newDescription: diff.mobileBg.description ?? null,
          url: diff.carsBg.url || diff.mobileBg.url,
        });
      }

      for (const carsId of plan.staleCarsIds) {
        emit({
          type: 'stale',
          dealer: dealer.slug,
          carsId,
        });
      }

      if (!dryRun) {
        const result = await syncCarsBgDealer(db, dealer, {
          dryRun: false,
          logger: (message) => emit({ type: 'log', dealer: dealer.slug, message }),
        });

        totals.updated += result.updated;
        totals.created += result.created;
        totals.deleted += result.deleted;
        totals.failedUpdates += result.failedUpdates;
        totals.failedCreates += result.failedCreates;
        totals.failedDeletes += result.failedDeletes;

        emit({
          type: 'done',
          dealer: dealer.slug,
          updated: result.updated,
          created: result.created,
          deleted: result.deleted,
          failedUpdates: result.failedUpdates,
          failedCreates: result.failedCreates,
          failedDeletes: result.failedDeletes,
        });
      }
    }

    emit({
      type: 'end',
      dryRun,
      missing: totals.missing,
      diffs: totals.diffs,
      stale: totals.stale,
      updated: totals.updated,
      created: totals.created,
      deleted: totals.deleted,
      failedUpdates: totals.failedUpdates,
      failedCreates: totals.failedCreates,
      failedDeletes: totals.failedDeletes,
      message: dryRun
        ? `Cars.bg sync plan ready: ${totals.missing} missing, ${totals.diffs} diffs, ${totals.stale} stale`
        : `Cars.bg sync finished: ${totals.updated} updated, ${totals.created} created, ${totals.deleted} deleted`,
    });
  } finally {
    db.close();
  }
}

main().catch((err) => {
  emit({ type: 'error', message: formatError(err) });
  process.exitCode = 1;
});
