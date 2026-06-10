import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { DB_PATH } from '@/lib/storage-paths';

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('busy_timeout = 5000');
sqlite.pragma('temp_store = MEMORY');
sqlite.pragma('cache_size = -64000');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export const raw = sqlite;
