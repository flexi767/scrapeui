import fsp from 'fs/promises';
import path from 'path';
import type Database from 'better-sqlite3';
import type { Page } from 'playwright';
import { acceptMobileBgCookies } from '@/lib/mobile-bg/auth';
import { SCRAPED_ROOT } from '@/lib/storage-paths';
import { errorMessage } from '@/lib/utils';

interface DealerLike {
  id: number;
  slug: string;
}

function normalizePaidStatus(value: string | null | undefined): 'TOP' | 'VIP' | 'none' {
  const text = (value || '').trim();
  if (!text) return 'none';
  if (/ТОП|BEST/i.test(text)) return 'TOP';
  if (/VIP/i.test(text)) return 'VIP';
  return 'none';
}

function normalizeMobileBgDateTime(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/(\d{2})\.(\d{2})\.(\d{4})\/(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, day, month, year, hour, minute] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:00`;
}

function getSnapshotDir(dbPath: string, dealerSlug: string, mobileId: string): string {
  void dbPath;
  return path.join(SCRAPED_ROOT, dealerSlug, mobileId, 'edit-form');
}

export async function submitMyAdsEditForm(page: Page, listingId: string, listingToken: string) {
  try {
    await page.evaluate(({ listingId: id, listingToken: token }) => {
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
  } catch (error) {
    const message = errorMessage(error);
    if (!/Execution context was destroyed|Cannot find context with specified id/i.test(message)) {
      throw error;
    }
  }
}

export async function captureEditFormSnapshotWithPage(
  db: Database.Database,
  dealer: DealerLike,
  mobileId: string,
  dbPath: string,
  page: Page,
  refs?: { listingId?: number | null; backupId?: number | null },
): Promise<{ snapshotId: number; screenshotPath: string | null; views: number | null; watching: number | null; adStatus: 'TOP' | 'VIP' | 'none' }> {
  const listingRow = refs?.listingId != null
    ? { id: refs.listingId }
    : db.prepare(`
        SELECT id
        FROM listings
        WHERE mobile_id = ?
        LIMIT 1
      `).get(mobileId) as { id?: number } | undefined;

  const backupRow = refs?.backupId != null
    ? { id: refs.backupId }
    : db.prepare(`
        SELECT id
        FROM mobilebg_backups
        WHERE mobile_id = ? AND dealer_id = ?
        ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
        LIMIT 1
      `).get(mobileId, dealer.id) as { id?: number } | undefined;

  const snapshotDir = getSnapshotDir(dbPath, dealer.slug, mobileId);
  await fsp.mkdir(snapshotDir, { recursive: true });

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
    const statusNode = rowNode?.querySelector(`#status_info_${listingId}`) || rowNode?.querySelector('[id^="status_info_"]');
    const rowText = rowNode?.textContent || '';
    const paidStatusText = statusNode?.textContent?.trim() || null;
    const updatedText = rowText.match(/Обновена в\s*(\d{2}\.\d{2}\.\d{4}\/\d{2}:\d{2}|\d{2}:\d{2}\/\d{2}\.\d{2}\.\d{4})/i)?.[1] || null;
    const refreshText = rowText.match(/Обнови\s+БЕЗПЛАТНО/i)?.[0]?.trim() || null;
    const viewsText = rowText.match(/Прегледана:\s*(\d+)\s*пъти/i)?.[1] || null;
    const viewedAtText = rowText.match(/Прегледана:\s*\d+\s*пъти\s*от\s*(\d{2}\.\d{2}\.\d{4}\/\d{2}:\d{2})/i)?.[1] || null;
    const watchingText = rowText.match(/Брой абонирани за известие при промяна в цената:\s*(\d+)/i)?.[1] || null;
    return {
      listingId,
      token,
      title: titleNode?.textContent?.trim() || null,
      priceText: priceNode?.textContent?.trim() || null,
      paidStatusText,
      updatedText,
      refreshText,
      viewsText,
      viewedAtText,
      watchingText,
      sourceUrl: location.href,
    };
  }, String(mobileId));

  if (!row?.token) {
    throw new Error(`Could not find edit action for listing ${mobileId}`);
  }

  await submitMyAdsEditForm(page, row.listingId, row.token);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1800);
  await acceptMobileBgCookies(page);

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
  await acceptMobileBgCookies(page);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const now = new Date().toISOString();
  const paidStatus = normalizePaidStatus(row.paidStatusText);
  const views = row.viewsText ? parseInt(row.viewsText, 10) || null : null;
  const viewedSinceDate = normalizeMobileBgDateTime(row.viewedAtText);
  const watching = row.watchingText ? parseInt(row.watchingText, 10) || null : null;
  const result = db.prepare(`
    INSERT INTO mobilebg_edit_form_snapshots (
      dealer_id, listing_id, backup_id, mobile_id, source_url, listing_token, row_title, row_price_text, row_refresh_text, views, viewed_since_date, watching, form_url,
      forms_json, fields_json, checked_boxes_json, checked_radios_json, hidden_json, screenshot_path, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    dealer.id,
    listingRow?.id ?? null,
    backupRow?.id ?? null,
    mobileId,
    row.sourceUrl,
    row.token,
    row.title,
    row.priceText,
    row.refreshText,
    views,
    viewedSinceDate,
    watching,
    formDump.formUrl,
    JSON.stringify(formDump.forms),
    JSON.stringify(formDump.fields),
    JSON.stringify(formDump.checkedBoxes),
    JSON.stringify(formDump.checkedRadios),
    JSON.stringify(formDump.hidden),
    screenshotPath,
    now,
  );

  if (backupRow?.id) {
    db.prepare(`
      UPDATE mobilebg_backups
      SET row_refresh_text = ?, views = ?, viewed_since_date = ?, watching = ?, ad_status = ?, updated_at = ?
      WHERE id = ?
    `).run(row.refreshText, views, viewedSinceDate, watching, paidStatus, now, backupRow.id);
  }

  if (listingRow?.id) {
    db.prepare(`
      UPDATE listings
      SET ad_status = ?
      WHERE id = ?
    `).run(paidStatus, listingRow.id);
  }

  return { snapshotId: Number(result.lastInsertRowid), screenshotPath, views, watching, adStatus: paidStatus };
}
