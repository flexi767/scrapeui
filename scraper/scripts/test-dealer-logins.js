#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require('better-sqlite3');
const { chromium } = require('playwright');
const { loginMobileBg } = require('../utils/mobilebg-auth');
const { loginToCarsBg } = require('../utils/carsbg-auth');

const DB_PATH = process.env.SCRAPEUI_DB_PATH || '/Users/v/dev/scraped/listings.db';
const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scraper/scripts/test-dealer-logins.js <dealer-slug>');
  process.exit(1);
}

async function main() {
  const db = new Database(DB_PATH, { readonly: true });
  const dealer = db.prepare(`
    SELECT slug, name, mobile_user, mobile_password, cars_user, cars_password
    FROM dealers WHERE slug = ?
  `).get(slug);
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
