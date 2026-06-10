#!/usr/bin/env node
// MIGRATED → scraper/scripts/fetch-publish-form.ts (CLI wrapper)
//            lib/mobile-bg/fetch-publish-form.ts (form extraction logic)
//            lib/mobile-bg/auth.ts (loginMobileBg)
/**
 * Logs in to mobile.bg as a dealer and dumps the publish/edit form fields.
 * Usage: node scripts/fetch-publish-form.js --dealer <slug> [--adv <mobileId>]
 *
 * Outputs a JSON map of all form fields with their names, types, and options.
 */
/* eslint-disable @typescript-eslint/no-require-imports */

const { chromium } = require('playwright');
const crypto = require('node:crypto');
const path = require('path');
const Database = require('better-sqlite3');
const { loginMobileBg } = require('../utils/mobilebg-auth');

/**
 * Inline decryptSecret for legacy CJS script.
 * Mirrors lib/crypto-credentials.ts — backward-compatible with plaintext values.
 */
function decryptSecret(stored) {
  if (!stored) return stored ?? null;
  const PREFIX = 'enc:v1:';
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext passthrough
  const rest = stored.slice(PREFIX.length);
  const parts = rest.split(':');
  if (parts.length !== 3) throw new Error('decryptSecret: malformed enc:v1: envelope');
  const [ivHex, authTagHex, cipherHex] = parts;
  const keyHex = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!keyHex || keyHex.trim().length !== 64) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY must be set to a 64-hex-character string');
  }
  const key = Buffer.from(keyHex.trim(), 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

const args = process.argv.slice(2);
const dealerIdx = args.indexOf('--dealer');
const dealerSlug = dealerIdx !== -1 ? args[dealerIdx + 1] : null;
const advIdx = args.indexOf('--adv');
const advId = advIdx !== -1 ? args[advIdx + 1] : null;

if (!dealerSlug) {
  console.error('Usage: node fetch-publish-form.js --dealer <slug> [--adv <mobileId>]');
  process.exit(1);
}

async function main() {
  const db = new Database(process.env.DB_PATH || path.resolve(__dirname, '../../../scraped/listings.db'));
  const dealer = db.prepare('SELECT * FROM dealers WHERE slug = ?').get(dealerSlug);
  if (!dealer) { console.error(`Dealer "${dealerSlug}" not found`); process.exit(1); }
  const decryptedPassword = decryptSecret(dealer.mobile_password);
  if (!dealer.mobile_user || !decryptedPassword) {
    console.error(`Dealer "${dealerSlug}" has no mobile.bg credentials`); process.exit(1);
  }

  // If no adv ID given, pick the most recent listing for this dealer
  let mobileId = advId;
  if (!mobileId) {
    const row = db.prepare('SELECT mobile_id FROM listings WHERE dealer_id = ? AND is_active = 1 ORDER BY last_seen_at DESC LIMIT 1').get(dealer.id);
    if (row) mobileId = row.mobile_id;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.error(`Logging in as ${dealer.mobile_user}...`);
  const ok = await loginMobileBg(page, dealer.mobile_user, decryptedPassword);
  if (!ok) { console.error('Login failed'); await browser.close(); process.exit(1); }
  console.error('Login OK');

  // Navigate to edit form (prefilled) or new listing form
  const formUrl = mobileId
    ? `https://www.mobile.bg/pcgi/mobile.cgi?pubtype=1&act=6&subact=4&actions=1&adv=${mobileId}`
    : `https://www.mobile.bg/pcgi/mobile.cgi?pubtype=1&act=6&subact=4&actions=1`;

  console.error(`Fetching form: ${formUrl}`);
  await page.goto(formUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Extract all form fields
  const fields = await page.evaluate(() => {
    const result = {};

    // Select elements
    document.querySelectorAll('select[name]').forEach(sel => {
      const name = sel.getAttribute('name');
      const options = Array.from(sel.options).map(opt => ({
        value: opt.value,
        label: opt.text.trim(),
        selected: opt.selected,
      }));
      result[name] = { type: 'select', options, current: sel.value };
    });

    // Text/number/hidden inputs
    document.querySelectorAll('input[name]').forEach(inp => {
      const name = inp.getAttribute('name');
      const type = inp.type || 'text';
      if (type === 'submit' || type === 'button' || type === 'image') return;
      if (type === 'radio') {
        if (!result[name]) result[name] = { type: 'radio', options: [] };
        result[name].options.push({ value: inp.value, checked: inp.checked, label: inp.closest('label')?.textContent?.trim() || inp.value });
        return;
      }
      if (type === 'checkbox') {
        if (!result[name]) result[name] = { type: 'checkbox', options: [] };
        result[name].options.push({ value: inp.value, checked: inp.checked, label: inp.closest('label')?.textContent?.trim() || inp.value });
        return;
      }
      result[name] = { type, current: inp.value };
    });

    // Textareas
    document.querySelectorAll('textarea[name]').forEach(ta => {
      result[ta.getAttribute('name')] = { type: 'textarea', current: ta.value };
    });

    return result;
  });

  console.log(JSON.stringify(fields, null, 2));
  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
