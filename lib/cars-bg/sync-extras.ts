import type { Page } from 'playwright';
import { prepareCarsBgPage } from '@/lib/cars-bg/auth';
import {
  type CarsBgSelectedExtra,
  type CarsBgExtrasPayload,
  normalizeLabel,
  EXTRA_BOOLEAN_FIELD_MAPPINGS,
  expandCarsBgExtraLabels,
  hasMappedBooleanExtra,
} from '@/lib/cars-bg/sync-mapping';
import { normalizeVatValue } from '@/lib/vat';

export interface CarsBgExtrasListing {
  euronorm: number | null;
  vat: string | null;
  extraLabels: string[];
  carsBgExtras: CarsBgExtrasPayload | null;
}

export async function applyCarsBgExtras(
  page: Page,
  extrasData: CarsBgExtrasPayload | null | undefined,
  extraLabels: string[] = [],
): Promise<boolean> {
  const selected = Array.isArray(extrasData?.selected) ? extrasData.selected : [];
  const normalizedExtraLabels = expandCarsBgExtraLabels(extraLabels);
  if (!selected.length && !normalizedExtraLabels.length) return false;

  const href = extrasData?.url || await page.evaluate(() => {
    const link = document.querySelector<HTMLAnchorElement>('a[sync-data="extrasSelectPage"]');
    return link?.href || link?.getAttribute('href') || null;
  }).catch(() => null);

  if (!href) return false;

  await page.goto(href, { waitUntil: 'domcontentloaded' });
  await prepareCarsBgPage(page);

  const labels = [
    ...selected.map((entry: CarsBgSelectedExtra) => normalizeLabel(entry.label || '')).filter(Boolean),
    ...normalizedExtraLabels,
  ];
  const pairs = selected.map((entry: CarsBgSelectedExtra) => `${entry.name || ''}::${entry.value || ''}`);

  await page.evaluate(({ expectedPairs, expectedLabels }) => {
    const normalize = (value = '') => value.toLowerCase().replace(/[^a-z0-9а-я\s]/gi, ' ').replace(/\s+/g, ' ').trim();
    for (const input of Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))) {
      const key = `${input.name || ''}::${input.value || ''}`;
      const labelText = normalize(
        (input.id ? document.querySelector(`label[for="${input.id}"]`)?.textContent : '') ||
        input.closest('label')?.textContent ||
        '',
      );
      if (expectedPairs.includes(key) || (labelText && expectedLabels.includes(labelText))) {
        if (!input.checked) {
          input.checked = true;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }
    const submit =
      document.querySelector('#publishBtn') ||
      document.querySelector('button[type="submit"]') ||
      document.querySelector('input[type="submit"]') ||
      document.querySelector('a.btn-thick');
    if (submit instanceof HTMLElement) submit.click();
    else document.querySelector('form')?.submit();
  }, { expectedPairs: pairs, expectedLabels: labels });

  await prepareCarsBgPage(page);
  return true;
}

async function applyCarsBgBooleanExtras(page: Page, extraLabels: string[]): Promise<void> {
  const fieldsToEnable = Object.keys(EXTRA_BOOLEAN_FIELD_MAPPINGS).filter((fieldName) =>
    hasMappedBooleanExtra(extraLabels, fieldName as keyof typeof EXTRA_BOOLEAN_FIELD_MAPPINGS),
  );
  if (fieldsToEnable.length === 0) return;

  await page.evaluate((expectedFields) => {
    for (const fieldName of expectedFields) {
      const input =
        document.querySelector<HTMLInputElement>(`#${fieldName}`) ||
        document.querySelector<HTMLInputElement>(`input[name="${fieldName}"]`);
      if (!input || input.checked) continue;
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, fieldsToEnable);
}

async function ensureCarsBgPriceOptions(page: Page): Promise<void> {
  await page.evaluate(() => {
    const selectors = ['#barter', '#leasing', 'input[name="barter"]', 'input[name="leasing"]'];
    for (const selector of selectors) {
      const input = document.querySelector<HTMLInputElement>(selector);
      if (!input || input.checked) continue;
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

async function applyCarsBgVatFlags(page: Page, vatValue: string | null | undefined): Promise<void> {
  if (normalizeVatValue(vatValue) !== 'included') return;
  await page.evaluate(() => {
    const input =
      document.querySelector<HTMLInputElement>('#dcredit') ||
      document.querySelector<HTMLInputElement>('input[name="dcredit"]');
    if (!input || input.checked) return;
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

export async function applyCarsBgSupplementalFields(
  page: Page,
  listing: CarsBgExtrasListing,
  selectRadio: (page: Page, name: string, value: number | string | null | undefined) => Promise<void>,
): Promise<void> {
  if (listing.euronorm != null) {
    await selectRadio(page, 'euroId', listing.euronorm);
  }
  await ensureCarsBgPriceOptions(page);
  await applyCarsBgVatFlags(page, listing.vat);
  await applyCarsBgBooleanExtras(page, listing.extraLabels);
  if (listing.carsBgExtras?.selected?.length || listing.extraLabels.length) {
    await applyCarsBgExtras(page, listing.carsBgExtras, listing.extraLabels).catch(() => {});
  }
}
