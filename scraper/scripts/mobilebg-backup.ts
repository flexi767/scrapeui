#!/usr/bin/env tsx

import Database from 'better-sqlite3';
import { backupDealerToDb, type DealerBackupConfig } from '@/lib/mobile-bg/backup';
import { DB_PATH } from '@/scraper/lib/runner';

const args = process.argv.slice(2);
const dealerIdx = args.indexOf('--dealer');
const dealerSlug = dealerIdx !== -1 ? args[dealerIdx + 1] : null;

if (!dealerSlug) {
  console.error('Usage: tsx scraper/scripts/mobilebg-backup.ts --dealer <slug>');
  process.exit(1);
}

interface DealerRow {
  id: number;
  slug: string;
  name: string;
  own: number;
  mobile_url: string | null;
  mobile_user: string | null;
  mobile_password: string | null;
}

async function main() {
  const db = new Database(DB_PATH);
  const dealer = db.prepare(`
    SELECT id, slug, name, own, mobile_url, mobile_user, mobile_password
    FROM dealers
    WHERE slug = ?
  `).get(dealerSlug) as DealerRow | undefined;

  if (!dealer) {
    console.error(`Dealer "${dealerSlug}" not found`);
    process.exit(1);
  }
  if (!dealer.mobile_url) {
    console.error(`Dealer "${dealerSlug}" has no mobile.bg URL`);
    process.exit(1);
  }
  if (!dealer.mobile_user || !dealer.mobile_password) {
    console.error(`Dealer "${dealerSlug}" has no mobile.bg credentials`);
    process.exit(1);
  }

  const config: DealerBackupConfig = {
    id: dealer.id,
    slug: dealer.slug,
    name: dealer.name,
    own: dealer.own === 1,
    mobileUrl: dealer.mobile_url,
    mobileUser: dealer.mobile_user,
    mobilePassword: dealer.mobile_password,
  };

  const result = await backupDealerToDb(db, config, DB_PATH);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
