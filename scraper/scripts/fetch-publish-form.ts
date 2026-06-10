#!/usr/bin/env tsx
/**
 * CLI wrapper — logs in to mobile.bg and dumps the publish/edit form fields.
 * Usage: tsx scraper/scripts/fetch-publish-form.ts --dealer <slug> [--adv <mobileId>]
 */
import { chromium } from 'playwright';
import { loginMobileBg } from '@/lib/mobile-bg/auth';
import { fetchPublishForm } from '@/lib/mobile-bg/fetch-publish-form';
import { openDb } from '@/scraper/lib/runner';
import { decryptSecret } from '@/lib/crypto-credentials';

const args = process.argv.slice(2);
const dealerIdx = args.indexOf('--dealer');
const dealerSlug = dealerIdx !== -1 ? args[dealerIdx + 1] : null;
const advIdx = args.indexOf('--adv');
const advId = advIdx !== -1 ? args[advIdx + 1] : null;

if (!dealerSlug) {
  console.error('Usage: tsx scraper/scripts/fetch-publish-form.ts --dealer <slug> [--adv <mobileId>]');
  process.exit(1);
}

interface DealerRow { id: number; mobile_user: string | null; mobile_password: string | null; }
interface ListingRow { mobile_id: string; }

async function main() {
  const db = openDb();
  const dealer = db.prepare('SELECT id, mobile_user, mobile_password FROM dealers WHERE slug = ?').get(dealerSlug) as DealerRow | undefined;
  if (!dealer) { console.error(`Dealer "${dealerSlug}" not found`); process.exit(1); }
  const decryptedPassword = decryptSecret(dealer.mobile_password);
  if (!dealer.mobile_user || !decryptedPassword) { console.error(`Dealer "${dealerSlug}" has no mobile.bg credentials`); process.exit(1); }

  let mobileId = advId;
  if (!mobileId) {
    const row = db.prepare('SELECT mobile_id FROM listings WHERE dealer_id = ? AND is_active = 1 ORDER BY last_seen_at DESC LIMIT 1').get(dealer.id) as ListingRow | undefined;
    if (row) mobileId = row.mobile_id;
  }

  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();

  console.error(`Logging in as ${dealer.mobile_user}...`);
  if (!await loginMobileBg(page, dealer.mobile_user, decryptedPassword)) {
    console.error('Login failed'); await browser.close(); process.exit(1);
  }
  console.error('Login OK');

  const fields = await fetchPublishForm(page, mobileId);
  console.log(JSON.stringify(fields, null, 2));
  await browser.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
