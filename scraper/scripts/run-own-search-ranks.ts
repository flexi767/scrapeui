#!/usr/bin/env tsx

import util from 'util';
import { runOwnSearchRankChecks, type OwnSearchRankProgressEvent } from '@/lib/mobile-bg/own-search-ranks';

const args = process.argv.slice(2);
const missingOnly = args.includes('--missing-only');

function emit(payload: object) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function formatError(error: unknown) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return util.inspect(error, { depth: 4, breakLength: 120 });
}

function progressMessage(event: OwnSearchRankProgressEvent) {
  if (event.type === 'start') {
    return event.missingOnly
      ? `Starting own-listing search check for ${event.stats.total} missing listings`
      : `Starting own-listing search check for ${event.stats.total} listings`;
  }

  if (event.type === 'checking') {
    const label = [event.target.make, event.target.model, event.target.title].filter(Boolean).join(' ');
    return `Checking ${event.stats.checked + 1}/${event.stats.total}: ${label || event.target.mobile_id || `listing ${event.target.listing_id}`}`;
  }

  if (event.type === 'result') {
    const title = [event.row.make, event.row.model, event.row.title].filter(Boolean).join(' ');
    const positions = event.row.found
      ? `orig #${event.row.original_position ?? '—'} • price #${event.row.price_position ?? '—'}`
      : 'not found in search results';
    return `${title || event.row.mobile_id || `listing ${event.row.listing_id}`} • ${positions}`;
  }

  return `Completed ${event.stats.checked}/${event.stats.total} checks`;
}

async function main() {
  emit({ type: 'log', level: 'info', message: 'Preparing search-position run…' });

  const summary = await runOwnSearchRankChecks({
    missingOnly,
    onProgress(event) {
      if (event.type === 'complete') return;
      emit({
        ...event,
        message: progressMessage(event),
      });
    },
  });

  emit({
    type: 'complete',
    code: 0,
    total: summary.total,
    found: summary.found,
    notFound: summary.notFound,
    rows: summary.rows,
    message: `Checked ${summary.total} listings • found ${summary.found} • missing ${summary.notFound}`,
  });
}

main().catch((error) => {
  emit({
    type: 'error',
    message: formatError(error),
  });
  process.exitCode = 1;
});
