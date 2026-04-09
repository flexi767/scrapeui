#!/usr/bin/env tsx

import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import {
  DEFAULT_MOBILEBG_PUBTYPE,
  DEFAULT_MOBILEBG_SEARCH_PATH,
  syncMobileBgMakeModelReference,
  type MobileBgMakeModelSyncProgressEvent,
} from '@/lib/mobile-bg/reference';

const args = process.argv.slice(2);

function getArg(name: string): string | null {
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

function emit(event: unknown) {
  console.log(JSON.stringify(event));
}

async function main() {
  const __dirname = fileURLToPath(new URL('.', import.meta.url));
  const dbPath = process.env.DB_PATH || path.resolve(__dirname, '../../../scraped/listings.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

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
      dbPath,
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
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
