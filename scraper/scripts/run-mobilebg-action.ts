import { raw } from '@/db/client';
import { getMobileBgDealerConfig } from '@/lib/dealers/mobileBgDealer';
import { getDealerBySlug } from '@/lib/queries';
import { captureEditFormSnapshot } from '@/lib/mobile-bg/edit-form';
import { repostBackupFromDb } from '@/lib/mobile-bg/repost';
import { updateBackupOnMobileBg } from '@/lib/mobile-bg/update';
import { emit, formatError } from '@/scraper/lib/runner';

type ActionName = 'repost' | 'update' | 'capture-edit-form';

interface ActionArgs {
  action: ActionName;
  dealerSlug: string;
  backupId: number | null;
  mobileId: string | null;
}

function readFlag(args: string[], flag: string): string | null {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

function parseActionArgs(args = process.argv.slice(2)): ActionArgs {
  const action = readFlag(args, '--action');
  if (action !== 'repost' && action !== 'update' && action !== 'capture-edit-form') {
    throw new Error(`Unknown or missing --action: ${action ?? '(none)'}`);
  }

  const dealerSlug = readFlag(args, '--dealer');
  if (!dealerSlug) throw new Error('Missing --dealer <slug>');

  const backupIdRaw = readFlag(args, '--backup-id');
  const backupId = backupIdRaw ? Number.parseInt(backupIdRaw, 10) : null;
  if (backupIdRaw && (!Number.isInteger(backupId) || (backupId as number) <= 0)) {
    throw new Error(`Invalid --backup-id: ${backupIdRaw}`);
  }

  return { action, dealerSlug, backupId, mobileId: readFlag(args, '--mobile-id') };
}

async function main() {
  const { action, dealerSlug, backupId, mobileId } = parseActionArgs();

  const dealer = getDealerBySlug(dealerSlug);
  const mobileBgDealer = getMobileBgDealerConfig(dealer);
  if (!mobileBgDealer) {
    throw new Error('Dealer not found or missing mobile.bg credentials');
  }

  const log = (message: string) => emit({ type: 'log', level: 'info', message });

  switch (action) {
    case 'repost': {
      if (!backupId) throw new Error('repost requires --backup-id');
      log(`Reposting backup #${backupId} for ${dealerSlug}…`);
      const result = await repostBackupFromDb(raw, mobileBgDealer, backupId);
      emit({ type: 'result', action, ...result });
      break;
    }
    case 'update': {
      if (!backupId) throw new Error('update requires --backup-id');
      log(`Updating backup #${backupId} on mobile.bg for ${dealerSlug}…`);
      const result = await updateBackupOnMobileBg(raw, mobileBgDealer, backupId, { log });
      emit({ type: 'result', action, ...result });
      break;
    }
    case 'capture-edit-form': {
      if (!mobileId) throw new Error('capture-edit-form requires --mobile-id');
      log(`Capturing edit form for mobile.bg #${mobileId} (${dealerSlug})…`);
      const result = await captureEditFormSnapshot(raw, mobileBgDealer, mobileId);
      emit({ type: 'result', action, ...result });
      break;
    }
  }
}

void main().catch((error) => {
  emit({ type: 'error', message: formatError(error) });
  process.exitCode = 1;
});
