#!/usr/bin/env tsx
import Database from 'better-sqlite3';
import { chromium } from 'playwright';
import { getCarsBgDealerAccount } from '@/lib/dealers/carsBgDealer';
import { getMobileBgDealerConfig } from '@/lib/dealers/mobileBgDealer';
import { loginMobileBg } from '@/lib/mobile-bg/auth';
import { loginToCarsBg } from '@/lib/cars-bg/auth';
import { DB_PATH } from '@/scraper/lib/runner';

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: tsx scraper/scripts/test-dealer-logins.ts <dealer-slug>');
  process.exit(1);
}

async function main() {
  const db = new Database(DB_PATH, { readonly: true });
  const dealer = db.prepare(`
    SELECT id, slug, name, mobile_url, mobile_user, mobile_password, cars_url, cars_user, cars_password
    FROM dealers WHERE slug = ?
  `).get(slug) as {
    cars_password: string | null;
    cars_url: string | null;
    cars_user: string | null;
    id: number;
    mobile_password: string | null;
    mobile_url: string | null;
    mobile_user: string | null;
    name: string;
    slug: string;
  } | undefined;
  db.close();

  if (!dealer) throw new Error(`Dealer not found: ${slug}`);
  const mobileBgDealer = getMobileBgDealerConfig(dealer);
  const carsBgDealer = getCarsBgDealerAccount(dealer);

  const browser = await chromium.launch({ headless: true });
  try {
    if (mobileBgDealer) {
      const page = await browser.newPage();
      const ok = await loginMobileBg(page, mobileBgDealer.mobileUser, mobileBgDealer.mobilePassword);
      console.log(JSON.stringify({ dealer: slug, service: 'mobile.bg', ok }));
      await page.close();
    } else {
      console.log(JSON.stringify({ dealer: slug, service: 'mobile.bg', ok: false, reason: 'missing_credentials' }));
    }

    if (carsBgDealer) {
      const page = await browser.newPage();
      const ok = await loginToCarsBg(page, carsBgDealer.carsUser, carsBgDealer.carsPassword);
      console.log(JSON.stringify({ dealer: slug, service: 'cars.bg', ok }));
      await page.close();
    } else {
      console.log(JSON.stringify({ dealer: slug, service: 'cars.bg', ok: false, reason: 'missing_credentials' }));
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
