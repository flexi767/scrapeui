import { raw } from '@/db/client';
import { getEditOwnSyncRows } from '@/lib/queries';
import {
  closeMobileBgUpdateSession,
  createMobileBgUpdateSession,
  updateBackupOnMobileBg,
} from '@/lib/mobile-bg/update';
import { getMobileBgDealerBySlug } from '@/lib/query-modules/mobilebg';
import { emit } from '@/scraper/lib/runner';
import { errorMessage } from '@/lib/utils';

interface SyncTarget {
  backup_id: number;
  mobile_id: string | null;
  title: string | null;
  make: string | null;
  model: string | null;
  dealer_name: string | null;
  dealer_slug: string | null;
}

async function main() {
  const queue = getEditOwnSyncRows().filter((row) => row.needs_sync === 1);
  let completed = 0;
  let succeeded = 0;
  let failed = 0;

  emit({
    type: 'start',
    total: queue.length,
    completed,
    succeeded,
    failed,
    message: queue.length > 0
      ? `Starting batch sync for ${queue.length} listing${queue.length === 1 ? '' : 's'}…`
      : 'No changed listings are waiting for sync.',
  });

  if (queue.length === 0) {
    emit({ type: 'complete', total: 0, completed: 0, succeeded: 0, failed: 0, message: 'Nothing to sync.' });
    return;
  }

  let activeDealerSlug: string | null = null;
  let activeSession: Awaited<ReturnType<typeof createMobileBgUpdateSession>> | null = null;

  try {
    for (const row of queue) {
      const target: SyncTarget = {
        backup_id: row.backup_id,
        mobile_id: row.mobile_id,
        title: row.title,
        make: row.make,
        model: row.model,
        dealer_name: row.dealer_name,
        dealer_slug: row.dealer_slug,
      };

      emit({
        type: 'checking',
        total: queue.length,
        completed,
        succeeded,
        failed,
        target,
        message: `Syncing ${[row.make, row.model, row.title].filter(Boolean).join(' ') || row.mobile_id || `backup ${row.backup_id}`}…`,
      });

      const dealer = getMobileBgDealerBySlug(row.dealer_slug ?? '');

      if (!dealer || !dealer.mobile_user || !dealer.mobile_password) {
        completed += 1;
        failed += 1;
        emit({
          type: 'result',
          total: queue.length,
          completed,
          succeeded,
          failed,
          row: {
            backup_id: row.backup_id,
            mobile_id: row.mobile_id,
            status: 'failed',
            completed_at: new Date().toISOString(),
            error: 'Dealer not found or missing mobile.bg credentials',
          },
          message: 'Dealer not found or missing mobile.bg credentials',
        });
        continue;
      }

      try {
        if (activeDealerSlug !== dealer.slug || !activeSession) {
          if (activeSession) {
            emit({ type: 'log', level: 'info', message: `Closing mobile.bg session for ${activeDealerSlug}…` });
            await closeMobileBgUpdateSession(activeSession);
            activeSession = null;
          }

          activeDealerSlug = dealer.slug;
          activeSession = await createMobileBgUpdateSession(
            {
              id: dealer.id,
              slug: dealer.slug,
              name: dealer.name,
              mobileUrl: '',
              mobileUser: dealer.mobile_user,
              mobilePassword: dealer.mobile_password,
            },
            (message) => emit({ type: 'log', level: 'info', dealer_slug: dealer.slug, message }),
          );
        }

        await updateBackupOnMobileBg(
          raw,
          {
            id: dealer.id,
            slug: dealer.slug,
            name: dealer.name,
            mobileUrl: '',
            mobileUser: dealer.mobile_user,
            mobilePassword: dealer.mobile_password,
          },
          row.backup_id,
          raw.name,
          {
            log: (message) => emit({ type: 'log', level: 'info', backup_id: row.backup_id, message }),
            session: activeSession,
          },
        );

        completed += 1;
        succeeded += 1;
        emit({
          type: 'result',
          total: queue.length,
          completed,
          succeeded,
          failed,
          row: {
            backup_id: row.backup_id,
            mobile_id: row.mobile_id,
            status: 'success',
            completed_at: new Date().toISOString(),
            error: null,
          },
          message: `Finished syncing mobile.bg #${row.mobile_id}`,
        });
      } catch (error) {
        if (activeSession && activeDealerSlug === dealer.slug) {
          await closeMobileBgUpdateSession(activeSession).catch(() => {});
          activeSession = null;
        }

        completed += 1;
        failed += 1;
        emit({
          type: 'result',
          total: queue.length,
          completed,
          succeeded,
          failed,
          row: {
            backup_id: row.backup_id,
            mobile_id: row.mobile_id,
            status: 'failed',
            completed_at: new Date().toISOString(),
            error: errorMessage(error),
          },
          message: errorMessage(error),
        });
      }
    }
  } finally {
    if (activeSession) {
      emit({ type: 'log', level: 'info', message: `Closing mobile.bg session for ${activeDealerSlug}…` });
      await closeMobileBgUpdateSession(activeSession).catch(() => {});
    }
  }

  emit({
    type: 'complete',
    total: queue.length,
    completed,
    succeeded,
    failed,
    message: `Batch sync finished. ${succeeded} succeeded, ${failed} failed.`,
  });
}

void main().catch((error) => {
  emit({ type: 'error', message: errorMessage(error) });
  process.exitCode = 1;
});
