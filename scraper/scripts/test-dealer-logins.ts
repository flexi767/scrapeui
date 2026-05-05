#!/usr/bin/env tsx
import Database from 'better-sqlite3';
import { chromium } from 'playwright';
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
    SELECT slug, name, mobile_user, mobile_password, cars_user, cars_password
    FROM dealers WHERE slug = ?
  `).get(slug) as { slug: string; name: string; mobile_user: string | null; mobile_password: string | null; cars_user: string | null; cars_password: string | null } | undefined;
  db.close();

  if (!dealer) throw new Error(`Dealer not found: ${slug}`);

  const browser = await chromium.launch({ headless: true });
  try {
    if (dealer.mobile_user && dealer.mobile_password) {
      const page = await browser.newPage();
      const ok = await loginMobileBg(page, dealer.mobile_user, dealer.mobile_password);
      console.log(JSON.stringify({ dealer: slug, service: 'mobile.bg', ok }));
      await page.close();
    } else {
      console.log(JSON.stringify({ dealer: slug, service: 'mobile.bg', ok: false, reason: 'missing_credentials' }));
    }

    if (dealer.cars_user && dealer.cars_password) {
      const page = await browser.newPage();
      const ok = await loginToCarsBg(page, dealer.cars_user, dealer.cars_password);
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
