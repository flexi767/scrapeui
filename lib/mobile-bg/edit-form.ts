import fsp from 'fs/promises';
import path from 'path';
import type Database from 'better-sqlite3';
import { chromium } from 'playwright';
import { loginMobileBg } from '@/lib/mobile-bg/auth';
import { USER_AGENT } from '@/lib/mobile-bg/constants';
import { getStorageRoot, type DealerBackupConfig } from '@/lib/mobile-bg/backup';

function getSnapshotDir(dbPath: string, dealerSlug: string, mobileId: string): string {
  return path.join(getStorageRoot(dbPath), dealerSlug, mobileId, 'edit-form');
}

async function submitMyAdsEditForm(page: import('playwright').Page, listingId: string, listingToken: string) {
  return page.evaluate(({ listingId: id, listingToken: token }) => {
    const form = (document.forms.namedItem('search') as HTMLFormElement | null) || (document as Document & { search?: HTMLFormElement }).search || null;
    if (!form) throw new Error('My Ads search form not found');
    (form.elements.namedItem('actions') as HTMLInputElement).value = '22';
    (form.elements.namedItem('s3') as HTMLInputElement).value = '1';
    (form.elements.namedItem('s4') as HTMLInputElement).value = '1';
    const s5 = form.elements.namedItem('s5') as HTMLInputElement | null;
    if (s5 && !s5.value) s5.value = '2';
    (form.elements.namedItem('step') as HTMLInputElement).value = '1';
    (form.elements.namedItem('f1') as HTMLInputElement).value = id;
    (form.elements.namedItem('f2') as HTMLInputElement).value = token;
    form.submit();
  }, { listingId, listingToken });
}

export async function captureEditFormSnapshot(
  db: Database.Database,
  dealer: DealerBackupConfig,
  mobileId: string,
  dbPath: string,
): Promise<{ snapshotId: number; screenshotPath: string | null }> {
  const listingRow = db.prepare(`
    SELECT id
    FROM listings
    WHERE mobile_id = ?
    LIMIT 1
  `).get(mobileId) as { id?: number } | undefined;

  const backupRow = db.prepare(`
    SELECT id
    FROM mobilebg_backups
    WHERE mobile_id = ? AND dealer_id = ?
    ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
    LIMIT 1
  `).get(mobileId, dealer.id) as { id?: number } | undefined;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();
  const snapshotDir = getSnapshotDir(dbPath, dealer.slug, mobileId);
  await fsp.mkdir(snapshotDir, { recursive: true });

  try {
    if (!await loginMobileBg(page, dealer.mobileUser, dealer.mobilePassword)) {
      throw new Error(`Login failed for ${dealer.slug}`);
    }

    await page.goto('https://www.mobile.bg/pcgi/mobile.cgi?act=6&subact=4&actions=23', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const row = await page.evaluate((targetId) => {
      const anchors = Array.from(document.querySelectorAll('a[onclick]'));
      const hit = anchors.find((a) =>
        (a.getAttribute('onclick') || '').includes(`f1.value='${targetId}'`) &&
        (a.textContent || '').includes('Редакция на текста'),
      ) as HTMLAnchorElement | undefined;
      if (!hit) return null;
      const onclick = hit.getAttribute('onclick') || '';
      const listingId = onclick.match(/f1\.value='([^']+)'/)?.[1] || targetId;
      const token = onclick.match(/f2\.value='([^']+)'/)?.[1] || null;
      const rowNode = hit.closest('item') || hit.closest('div');
      const titleNode = rowNode?.querySelector('.title');
      const priceNode = rowNode?.querySelector('.price');
      return {
        listingId,
        token,
        title: titleNode?.textContent?.trim() || null,
        priceText: priceNode?.textContent?.trim() || null,
        sourceUrl: location.href,
      };
    }, String(mobileId));

    if (!row?.token) {
      throw new Error(`Could not find edit action for listing ${mobileId}`);
    }

    await submitMyAdsEditForm(page, row.listingId, row.token);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1800);

    const formDump = await page.evaluate(() => {
      const forms = Array.from(document.forms).map((form) => ({
        name: form.getAttribute('name') || null,
        id: form.getAttribute('id') || null,
        method: form.getAttribute('method') || 'GET',
        action: form.getAttribute('action') || null,
      }));

      const fields = Array.from(document.querySelectorAll('input, select, textarea')).map((el) => {
        const element = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        const tag = element.tagName.toLowerCase();
        const base = {
          tag,
          name: element.getAttribute('name') || null,
          id: element.getAttribute('id') || null,
          type: 'type' in element ? element.type || null : null,
          value: 'value' in element ? element.value ?? null : null,
          checked: 'checked' in element ? (element as HTMLInputElement).checked : null,
          disabled: !!element.disabled,
          required: !!element.required,
          placeholder: element.getAttribute('placeholder') || null,
          form: element.form?.getAttribute('name') || element.form?.getAttribute('id') || null,
        };
        if (tag === 'select') {
          return {
            ...base,
            options: Array.from((element as HTMLSelectElement).options).map((opt) => ({
              value: opt.value,
              text: opt.textContent?.trim() || '',
              selected: opt.selected,
            })),
          };
        }
        return base;
      });

      const checkedBoxes = fields.filter((f) => f.type === 'checkbox' && f.checked).map((f) => ({ name: f.name, value: f.value }));
      const checkedRadios = fields.filter((f) => f.type === 'radio' && f.checked).map((f) => ({ name: f.name, value: f.value }));
      const hidden = fields
        .filter((f) => f.type === 'hidden' && f.name)
        .reduce<Record<string, string | null>>((acc, field) => {
          acc[field.name as string] = field.value as string | null;
          return acc;
        }, {});

      return {
        formUrl: location.href,
        forms,
        fields,
        checkedBoxes,
        checkedRadios,
        hidden,
      };
    });

    const screenshotPath = path.join(snapshotDir, 'edit-form.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO mobilebg_edit_form_snapshots (
        dealer_id, listing_id, backup_id, mobile_id, source_url, listing_token, row_title, row_price_text, form_url,
        forms_json, fields_json, checked_boxes_json, checked_radios_json, hidden_json, screenshot_path, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      dealer.id,
      listingRow?.id ?? null,
      backupRow?.id ?? null,
      mobileId,
      row.sourceUrl,
      row.token,
      row.title,
      row.priceText,
      formDump.formUrl,
      JSON.stringify(formDump.forms),
      JSON.stringify(formDump.fields),
      JSON.stringify(formDump.checkedBoxes),
      JSON.stringify(formDump.checkedRadios),
      JSON.stringify(formDump.hidden),
      screenshotPath,
      now,
    );

    return { snapshotId: Number(result.lastInsertRowid), screenshotPath };
  } finally {
    await browser.close();
  }
}
