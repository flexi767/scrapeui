#!/usr/bin/env tsx

import {
  DEFAULT_MOBILEBG_PUBTYPE,
  DEFAULT_MOBILEBG_SEARCH_PATH,
  syncMobileBgMakeModelReference,
  type MobileBgMakeModelSyncProgressEvent,
} from '@/lib/mobile-bg/reference';
import { emit, formatError, openDb, DB_PATH } from '@/scraper/lib/runner';

const args = process.argv.slice(2);

function getArg(name: string): string | null {
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

async function main() {
  const db = openDb();

  const onlyMake = getArg('--make');
  const searchPath = getArg('--search-path') || DEFAULT_MOBILEBG_SEARCH_PATH;
  const pubtype = getArg('--pubtype') || DEFAULT_MOBILEBG_PUBTYPE;

  try {
    emit({
      type: 'status',
      message: `Starting mobile.bg make/model sync${onlyMake ? ` for ${onlyMake}` : ''}`,
      searchPath,
      pubtype,
      onlyMake,
    });

    const result = await syncMobileBgMakeModelReference(db, {
      onlyMake,
      searchPath,
      pubtype,
      onProgress(event: MobileBgMakeModelSyncProgressEvent) {
        emit(event);
      },
    });

    emit({
      type: 'complete',
      ok: true,
      dbPath: DB_PATH,
      searchPath,
      pubtype,
      onlyMake,
      ...result,
      message: 'Sync completed',
    });
  } finally {
    db.close();
  }
}

main().catch((error) => {
  emit({ type: 'error', message: formatError(error) });
  process.exit(1);
});
