import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import type Database from 'better-sqlite3';
import { chromium, type Page } from 'playwright';
import { CARS_BG_BASE_URL, loginToCarsBg, prepareCarsBgPage } from '@/lib/cars-bg/auth';
import { USER_AGENT } from '@/lib/mobile-bg/constants';
import { getCdnImageUrl, parseJson, type ImageMeta } from '@/lib/utils';

const fsp = fs.promises;
const MAX_PHOTO_UPLOADS = 15;
const CARS_BG_OBJECT_TYPE_CAR = 1;
const LOCAL_IMAGE_BASE_DIR = '/Users/v/dev/scraped/carimg';
const PUBLISH_FORM_PATHS = [
  path.resolve(process.cwd(), 'data/publishcar.html'),
  '/Users/v/dev/scrapers/data/publishcar.html',
];

let sharpModule: typeof import('sharp') | null | undefined;

export interface CarsBgDealerAccount {
  id: number;
  slug: string;
  name: string | null;
  carsUrl: string | null;
  carsUser: string | null;
  carsPassword: string | null;
}

interface SyncListingRow {
  id: number;
  mobile_id: string | null;
  cars_id: string | null;
  dealer_id: number;
  url: string | null;
  title: string | null;
  carsbg_title: string | null;
  make: string | null;
  model: string | null;
  reg_month: string | null;
  reg_year: string | null;
  fuel: string | null;
  body_type: string | null;
  transmission: string | null;
  color: string | null;
  power: number | null;
  mileage: number | null;
  description: string | null;
  extras_json: string | null;
  ad_status: string | null;
  kaparo: number | null;
  current_price: number | null;
  vat: string | null;
  image_count: number | null;
  image_meta: string | null;
  full_keys: string | null;
  images_downloaded: number | null;
  latest_backup_id?: number | null;
}

interface CarsBgSelectedExtra {
  name?: string;
  value?: string;
  id?: string;
  label?: string;
  checked?: boolean;
}

interface CarsBgExtrasPayload {
  url?: string | null;
  summaryText?: string;
  selected?: CarsBgSelectedExtra[];
}

export interface CarsBgSyncListing {
  id: number;
  mobileId: string | null;
  carsId: string | null;
  url: string;
  title: string;
  carsbgTitle: string | null;
  fullTitle: string;
  make: string | null;
  model: string | null;
  year: string | null;
  month: string | null;
  fuel: string | null;
  category: string | null;
  transmission: string | null;
  color: string | null;
  power: number | null;
  mileage: number | null;
  description: string | null;
  adStatus: string;
  kaparo: boolean;
  vat: string | null;
  price: { amount: number | null; currency: 'EUR' };
  images: string[];
  carsBgExtras: CarsBgExtrasPayload | null;
}

interface CarsBgDiff {
  mobileBg: CarsBgSyncListing;
  carsBg: CarsBgSyncListing;
  priceDiff: boolean;
  titleDiff: boolean;
  descriptionDiff: boolean;
}

interface CarsBgSyncPlan {
  missing: CarsBgSyncListing[];
  diffs: CarsBgDiff[];
  staleCarsIds: string[];
}

export interface CarsBgSyncDealerResult extends CarsBgSyncPlan {
  updated: number;
  created: number;
  deleted: number;
  failedUpdates: number;
  failedCreates: number;
  failedDeletes: number;
  dryRun: boolean;
}

export function buildCarsBgOfferUrl(offerId: string, { myoffer = true, clear = true } = {}): string {
  const params = new URLSearchParams();
  if (myoffer) params.set('myoffer', '1');
  if (clear) params.set('clear', '1');
  const qs = params.toString();
  return `${CARS_BG_BASE_URL}/offer/${offerId}${qs ? `?${qs}` : ''}`;
}

export function buildCarsBgEditUrl(offerId: string, objectTypeId = CARS_BG_OBJECT_TYPE_CAR): string {
  return `${CARS_BG_BASE_URL}/editcar.php?objectId=${offerId}&object_typeId=${objectTypeId}`;
}

export function buildCarsBgEditPhotosUrl(offerId: string, objectTypeId = CARS_BG_OBJECT_TYPE_CAR): string {
  return `${CARS_BG_BASE_URL}/editphoto.php?objectId=${offerId}&object_typeId=${objectTypeId}`;
}

export function extractOfferId(input = ''): string | null {
  const value = String(input || '');
  const direct = value.match(/^[a-z0-9]{12,}$/i);
  if (direct) return direct[0];
  const offerMatch = value.match(/\/offer\/([^/?#]+)/i);
  if (offerMatch?.[1]) return offerMatch[1];
  const objectMatch = value.match(/[?&]objectId=([^&#]+)/i);
  if (objectMatch?.[1]) return objectMatch[1];
  return null;
}

export function extractMobileIdFromUrl(url = ''): string | null {
  const match = url.match(/obiava-(\d+)/);
  return match ? match[1] : null;
}

export function saveCarsId(db: Database.Database, mobileId: string, carsId: string): void {
  const now = new Date().toISOString();
  db.prepare('UPDATE listings SET cars_id = ?, cars_synced_at = ? WHERE mobile_id = ?').run(carsId, now, mobileId);
}

export function clearCarsId(db: Database.Database, carsId: string): void {
  const now = new Date().toISOString();
  db.prepare('UPDATE listings SET cars_id = NULL, cars_synced_at = ? WHERE cars_id = ?').run(now, carsId);
}

export function getStaleCarsBgListings(db: Database.Database, dealerSlug: string): string[] {
  const rows = db.prepare(`
    SELECT l.cars_id
    FROM listings l
    JOIN dealers d ON d.id = l.dealer_id
    WHERE d.slug = ?
      AND l.source = 'm'
      AND l.is_active = 0
      AND l.cars_id IS NOT NULL
  `).all(dealerSlug) as { cars_id: string }[];
  return rows.map((row) => row.cars_id).filter(Boolean);
}

function normalizeCompareText(value: string | null | undefined): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9а-я]+/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleOverlapScore(a: string | null | undefined, b: string | null | undefined): number {
  const aTokens = new Set(normalizeCompareText(a).split(' ').filter((token) => token.length > 2));
  const bTokens = new Set(normalizeCompareText(b).split(' ').filter((token) => token.length > 2));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap++;
  }
  return overlap;
}

function loadPublishFormHtml(): string {
  for (const filePath of PUBLISH_FORM_PATHS) {
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf8');
  }
  return '';
}

function normalizeLabel(value = ''): string {
  return String(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9а-я\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface OptionEntry {
  id: number;
  label: string;
  normalized: string;
}

interface OptionSet {
  options: OptionEntry[];
  sorted: OptionEntry[];
  map: Map<string, OptionEntry>;
}

function parseOptionMap(html: string, inputName: string): OptionSet {
  if (!html) return { options: [], sorted: [], map: new Map() };
  const regex = new RegExp(
    `<input[^>]*name=["']${inputName}["'][^>]*id=["'][^"']*_(\\d+)["'][^>]*?(?:value=["'](\\d+)["'])?[^>]*>\\s*<label[^>]*>([^<]+)<`,
    'gi',
  );
  const options: OptionEntry[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const id = Number(match[2] || match[1]);
    const label = match[3]?.trim();
    if (!label || Number.isNaN(id)) continue;
    options.push({ id, label, normalized: normalizeLabel(label) });
  }
  const sorted = [...options].sort((a, b) => b.normalized.length - a.normalized.length);
  const map = new Map(options.map((option) => [option.normalized, option]));
  return { options, sorted, map };
}

const publishFormHtml = loadPublishFormHtml();
const optionSets = publishFormHtml
  ? {
      brand: parseOptionMap(publishFormHtml, 'brandId'),
      category: parseOptionMap(publishFormHtml, 'categoryId'),
      condition: parseOptionMap(publishFormHtml, 'conditionId'),
      currency: parseOptionMap(publishFormHtml, 'currencyId'),
      color: parseOptionMap(publishFormHtml, 'colorId'),
      doors: parseOptionMap(publishFormHtml, 'doorId'),
    }
  : null;

const modelOptionsCache = new Map<number, OptionSet>();

const CATEGORY_SYNONYMS: Record<string, string> = {
  стретч: 'Седан',
  stretch: 'Седан',
  лимузина: 'Седан',
  седан: 'Седан',
  suv: 'Джип',
  джип: 'Джип',
  комби: 'Комби',
  кабрио: 'Кабрио',
};

const COLOR_SYNONYMS = [
  { keywords: ['тъмно', 'тъмен', 'тъмна'], replacement: 'Черен' },
];

function findOptionByLabel(optionSet: OptionSet | undefined | null, label: string | null | undefined): OptionEntry | null {
  if (!optionSet || !label) return null;
  return optionSet.map.get(normalizeLabel(label)) ?? null;
}

async function fetchModelOptions(brandId: number): Promise<OptionSet | null> {
  if (!brandId) return null;
  if (modelOptionsCache.has(brandId)) return modelOptionsCache.get(brandId)!;
  const res = await fetch(`${CARS_BG_BASE_URL}/carmodelpublish.php?brandId=${brandId}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const parsed = parseOptionMap(html, 'modelId');
  modelOptionsCache.set(brandId, parsed);
  return parsed;
}

function inferBrandFromTitle(title: string): OptionEntry | null {
  if (!optionSets?.brand) return null;
  const normalizedTitle = normalizeLabel(title);
  for (const option of optionSets.brand.sorted) {
    if (normalizedTitle.startsWith(option.normalized)) return option;
  }
  return null;
}

function inferModelFromTitle(title: string, brandLabel: string, modelOptions: OptionSet | null): OptionEntry | null {
  if (!modelOptions) return null;
  const remainder = title.replace(new RegExp(`^${brandLabel}\\s*`, 'i'), '').trim();
  const normalized = normalizeLabel(remainder);
  for (const option of modelOptions.sorted) {
    if (normalized.startsWith(option.normalized)) return option;
  }
  return null;
}

function mapCategory(categoryName: string | null | undefined): OptionEntry | null {
  if (!optionSets?.category || !categoryName) return null;
  const direct = findOptionByLabel(optionSets.category, categoryName);
  if (direct) return direct;
  const synonym = CATEGORY_SYNONYMS[normalizeLabel(categoryName)];
  if (synonym) {
    const mapped = findOptionByLabel(optionSets.category, synonym);
    if (mapped) return mapped;
  }
  return optionSets.category.options.find((option) => normalizeLabel(categoryName).includes(option.normalized))
    ?? findOptionByLabel(optionSets.category, 'Седан');
}

function normalizeColorToken(token = ''): string {
  return normalizeLabel(token).replace(/t(?=[а-я])/g, 'т');
}

function mapColor(colorName: string | null | undefined): OptionEntry | null {
  if (!optionSets?.color || !colorName) return null;
  const normalized = normalizeColorToken(colorName);
  const direct = optionSets.color.map.get(normalized);
  if (direct) return direct;
  const synonym = COLOR_SYNONYMS.find((entry) =>
    entry.keywords.some((word) => normalized.includes(normalizeColorToken(word))),
  );
  if (synonym) {
    const replacement = optionSets.color.map.get(normalizeColorToken(synonym.replacement));
    if (replacement) return replacement;
  }
  return optionSets.color.options.find((option) => normalized.includes(option.normalized)) ?? null;
}

function mapFuel(fuelName: string | null | undefined): { id: number; label: string } | null {
  const normalized = normalizeLabel(fuelName || '');
  if (!normalized) return null;
  if (normalized.includes('диз')) return { id: 2, label: 'Дизел' };
  if (normalized.includes('бенз')) return { id: 1, label: 'Бензин' };
  if (normalized.includes('газ')) return { id: 3, label: 'Газ/Бензин' };
  if (normalized.includes('метан')) return { id: 4, label: 'Метан/Бензин' };
  if (normalized.includes('хибрид')) return { id: 6, label: 'Хибрид' };
  if (normalized.includes('елект')) return { id: 7, label: 'Електричество' };
  return null;
}

function mapGear(transmission: string | null | undefined): { id: number; label: string } | null {
  const normalized = normalizeLabel(transmission || '');
  if (!normalized) return null;
  if (normalized.includes('автомат')) return { id: 2, label: 'Автоматични' };
  if (normalized.includes('ръч')) return { id: 1, label: 'Ръчни' };
  return null;
}

function mapDoors(categoryName: string | null | undefined): number {
  const normalized = normalizeLabel(categoryName || '');
  return new Set(['купе', 'кабрио']).has(normalized) ? 1 : 2;
}

function currencyIdFromCode(code = 'EUR'): number {
  const upper = code.toUpperCase();
  if (upper === 'BGN') return 1;
  if (upper === 'USD') return 2;
  return 3;
}

async function selectRadio(page: Page, name: string, value: number | string | null | undefined): Promise<void> {
  if (value == null) return;
  await page.evaluate(({ field, fieldValue }) => {
    const inputs = document.querySelectorAll<HTMLInputElement>(`input[name="${field}"][value="${fieldValue}"]`);
    inputs.forEach((input) => {
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }, { field: name, fieldValue: String(value) });
}

async function fillInput(page: Page, selector: string, value: string | number | null | undefined): Promise<void> {
  if (value == null || value === '') return;
  const input = await page.$(selector);
  if (!input) return;
  await input.fill('');
  await input.type(String(value), { delay: 10 });
}

async function fillTextarea(page: Page, selector: string, value: string | null | undefined): Promise<void> {
  if (!value) return;
  const input = await page.$(selector);
  if (!input) return;
  await input.fill('');
  await input.type(String(value).slice(0, 32000), { delay: 5 });
}

export async function extractCarsBgExtras(page: Page, extrasUrl?: string | null): Promise<CarsBgExtrasPayload> {
  const href = extrasUrl || await page.evaluate(() => {
    const link = document.querySelector<HTMLAnchorElement>('a[sync-data="extrasSelectPage"]');
    return link?.href || link?.getAttribute('href') || null;
  }).catch(() => null);

  if (!href) return { url: null, summaryText: '', selected: [] };

  const originalUrl = page.url();
  await page.goto(href, { waitUntil: 'domcontentloaded' });
  await prepareCarsBgPage(page);

  const extras = await page.evaluate(() => {
    const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();
    const nodes = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    const all = nodes.map((node) => {
      const label = node.id
        ? (document.querySelector(`label[for="${node.id}"]`)?.textContent || '')
        : (node.closest('label')?.textContent || '');
      return {
        name: node.name || '',
        value: node.value || '',
        id: node.id || '',
        checked: !!node.checked,
        label: normalize(label),
      };
    }).filter((entry) => entry.name || entry.value || entry.label);

    return {
      url: location.href,
      summaryText: normalize(document.body.innerText || ''),
      selected: all.filter((entry) => entry.checked),
    };
  });

  await page.goto(originalUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await prepareCarsBgPage(page);
  return extras;
}

export async function applyCarsBgExtras(page: Page, extrasData: CarsBgExtrasPayload | null | undefined): Promise<boolean> {
  const selected = Array.isArray(extrasData?.selected) ? extrasData.selected : [];
  if (!selected.length) return false;

  const href = extrasData?.url || await page.evaluate(() => {
    const link = document.querySelector<HTMLAnchorElement>('a[sync-data="extrasSelectPage"]');
    return link?.href || link?.getAttribute('href') || null;
  }).catch(() => null);

  if (!href) return false;

  await page.goto(href, { waitUntil: 'domcontentloaded' });
  await prepareCarsBgPage(page);

  const labels = selected.map((entry) => normalizeLabel(entry.label || '')).filter(Boolean);
  const pairs = selected.map((entry) => `${entry.name || ''}::${entry.value || ''}`);

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

async function getSharp() {
  if (sharpModule !== undefined) return sharpModule;
  try {
    sharpModule = await import('sharp');
  } catch {
    sharpModule = null;
  }
  return sharpModule;
}

async function convertToJpeg(filePath: string): Promise<string | null> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return filePath;
  const sharp = await getSharp();
  if (!sharp) return null;
  const jpegPath = filePath.replace(/\.[^.]+$/, '.jpg');
  await sharp.default(filePath).jpeg({ quality: 90 }).toFile(jpegPath);
  return jpegPath;
}

async function downloadImages(urls: string[], prefix: string): Promise<{ dir: string; files: string[] }> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), `cars-bg-${prefix || randomUUID()}-`));
  const files: string[] = [];
  const seen = new Set<string>();
  const uniqueUrls = urls.filter((url) => {
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });

  for (let i = 0; i < uniqueUrls.length && files.length < MAX_PHOTO_UPLOADS; i++) {
    const url = uniqueUrls[i];
    try {
      if (url.startsWith('/')) {
        if (!fs.existsSync(url)) continue;
        const ext = path.extname(url) || '.webp';
        const target = path.join(dir, `${i}${ext}`);
        await fsp.copyFile(url, target);
        files.push(target);
        continue;
      }

      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      const ext = path.extname(new URL(url).pathname) || '.jpg';
      const target = path.join(dir, `${i}${ext}`);
      await fsp.writeFile(target, buffer);
      files.push(target);
    } catch {
      continue;
    }
  }

  return { dir, files };
}

async function uploadImagesFallback(page: Page, files: string[]): Promise<void> {
  const initialCount = await page.evaluate(() => document.querySelectorAll('.photobox.haspic').length).catch(() => 0);
  for (let i = 0; i < files.length; i++) {
    const input = await page.$(`#uploadFile${i + 1}`).catch(() => null);
    if (!input) break;
    await input.setInputFiles([files[i]]);
    await page.evaluate((index) => {
      const input = document.getElementById(`uploadFile${index}`);
      if (input) input.dispatchEvent(new Event('change', { bubbles: true }));
    }, i + 1);
    const ok = await page.waitForFunction(
      (expected) => document.querySelectorAll('.photobox.haspic').length >= expected,
      { timeout: 15000 },
      initialCount + i + 1,
    ).then(() => true).catch(() => false);
    void ok;
    await page.waitForTimeout(600);
  }
}

async function uploadImages(page: Page, files: string[]): Promise<void> {
  const uploadCount = Math.min(files.length, MAX_PHOTO_UPLOADS);
  if (uploadCount === 0) return;

  const jpegFiles: string[] = [];
  for (const file of files.slice(0, uploadCount)) {
    const converted = await convertToJpeg(file).catch(() => null);
    if (converted) jpegFiles.push(converted);
  }
  if (jpegFiles.length === 0) return;

  const currentUrl = page.url();
  const offerIdMatch = currentUrl.match(/objectId=([a-f0-9]{24})/i);
  const offerId = offerIdMatch ? offerIdMatch[1] : '0';
  const uploadReady = await page.evaluate(() => typeof (window as Window & { UploadFiles?: unknown }).UploadFiles === 'function').catch(() => false);
  if (!uploadReady) {
    await uploadImagesFallback(page, jpegFiles);
    return;
  }

  for (const filePath of jpegFiles) {
    const fileBytes = await fsp.readFile(filePath);
    const base64 = fileBytes.toString('base64');
    const slotId = await page.evaluate(() => {
      const empty = document.querySelector('.photobox:not(.haspic)');
      if (!empty) return null;
      try {
        const args = empty.getAttribute('data-action-args');
        return args ? JSON.parse(args).fileId : null;
      } catch {
        return null;
      }
    });
    if (slotId == null) break;

    await page.evaluate(async ({ base64Data, slot, currentOfferId }) => {
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'image/jpeg' });
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });

      await new Promise<void>((resolve) => {
        const upload = (window as Window & { UploadFiles?: (slotId: number, file: File, files: File[], offerId: string) => void }).UploadFiles;
        if (typeof upload !== 'function') {
          resolve();
          return;
        }
        const observer = new MutationObserver(() => {
          if (document.querySelector(`#photobox_${slot}.haspic`)) {
            observer.disconnect();
            resolve();
          }
        });
        observer.observe(document.getElementById(`photobox_${slot}`) || document.body, {
          attributes: true,
          attributeFilter: ['class'],
          subtree: true,
        });
        setTimeout(() => {
          observer.disconnect();
          resolve();
        }, 20000);
        upload(slot, file, [file], currentOfferId);
      });
    }, { base64Data: base64, slot: slotId, currentOfferId: offerId });

    await page.waitForTimeout(500);
  }
}

function getBackupOrderedImages(db: Database.Database, backupId: number | null | undefined): string[] {
  if (!backupId) return [];
  const rows = db.prepare(`
    SELECT local_path, source_url
    FROM mobilebg_backup_images
    WHERE backup_id = ?
    ORDER BY sort_order ASC, id ASC
  `).all(backupId) as Array<{ local_path: string | null; source_url: string | null }>;

  return rows
    .map((row) => {
      if (row.local_path && fs.existsSync(row.local_path)) return row.local_path;
      return row.source_url;
    })
    .filter((value): value is string => Boolean(value));
}

function parseListingImageSources(db: Database.Database, row: SyncListingRow): string[] {
  const backupOrdered = getBackupOrderedImages(db, row.latest_backup_id);
  if (backupOrdered.length) return backupOrdered;

  const fullKeys = parseJson<string[]>(row.full_keys, []);
  if (!fullKeys.length || !row.mobile_id) return [];

  if (fullKeys[0]?.startsWith('http')) return fullKeys;

  if (row.images_downloaded === 1) {
    const local: string[] = [];
    for (let i = 0; i < fullKeys.length; i++) {
      const filename = `${String(i + 1).padStart(2, '0')}.webp`;
      const filePath = path.join(LOCAL_IMAGE_BASE_DIR, row.mobile_id, 'full', filename);
      if (fs.existsSync(filePath)) local.push(filePath);
    }
    if (local.length) return local;
  }

  const imageMeta = parseJson<ImageMeta | null>(row.image_meta, null);
  if (!imageMeta) return [];
  return fullKeys.map((key) => getCdnImageUrl(row.mobile_id!, key, imageMeta, 'full'));
}

function makeFullTitle(row: SyncListingRow): string {
  return [row.make, row.model, row.title].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

function mapRowToSyncListing(db: Database.Database, row: SyncListingRow): CarsBgSyncListing {
  const title = row.title || '';
  return {
    id: row.id,
    mobileId: row.mobile_id,
    carsId: row.cars_id,
    url: row.url || '',
    title,
    carsbgTitle: row.carsbg_title || null,
    fullTitle: makeFullTitle(row) || title,
    make: row.make,
    model: row.model,
    year: row.reg_year,
    month: row.reg_month,
    fuel: row.fuel,
    category: row.body_type,
    transmission: row.transmission,
    color: row.color,
    power: row.power,
    mileage: row.mileage,
    description: row.description,
    adStatus: row.ad_status || 'none',
    kaparo: row.kaparo === 1,
    vat: row.vat,
    price: { amount: row.current_price, currency: 'EUR' },
    images: parseListingImageSources(db, row),
    carsBgExtras: parseJson<CarsBgExtrasPayload | null>(row.extras_json, null),
  };
}

function loadDealerMobileListings(db: Database.Database, dealerId: number): CarsBgSyncListing[] {
  const rows = db.prepare(`
    SELECT
      id, mobile_id, cars_id, dealer_id, url, title, make, model, reg_month, reg_year, fuel,
      carsbg_title,
      body_type, transmission, color, power, mileage, description, extras_json,
      ad_status, kaparo, current_price, vat, image_count, image_meta, full_keys, images_downloaded,
      (
        SELECT b.id
        FROM mobilebg_backups b
        WHERE b.listing_id = listings.id
        ORDER BY COALESCE(b.updated_at, b.created_at) DESC, b.id DESC
        LIMIT 1
      ) as latest_backup_id
    FROM listings
    WHERE dealer_id = ?
      AND source = 'm'
      AND is_active = 1
      AND (duplicate = 0 OR duplicate IS NULL)
  `).all(dealerId) as SyncListingRow[];

  return rows.map((row) => mapRowToSyncListing(db, row));
}

function loadDealerCarsListings(db: Database.Database, dealerId: number): CarsBgSyncListing[] {
  const rows = db.prepare(`
    SELECT
      id, mobile_id, cars_id, dealer_id, url, title, make, model, reg_month, reg_year, fuel,
      carsbg_title,
      body_type, transmission, color, power, mileage, description, extras_json,
      ad_status, kaparo, current_price, vat, image_count, image_meta, full_keys, images_downloaded
    FROM listings
    WHERE dealer_id = ?
      AND source = 'c'
      AND is_active = 1
  `).all(dealerId) as SyncListingRow[];

  return rows.map((row) => mapRowToSyncListing(db, row));
}

function compareListings(mobile: CarsBgSyncListing[], cars: CarsBgSyncListing[]): CarsBgSyncPlan {
  const missing: CarsBgSyncListing[] = [];
  const diffs: CarsBgDiff[] = [];
  const matchedCars = new Set<number>();
  const carsById = new Map(cars.filter((entry) => entry.carsId).map((entry) => [entry.carsId!, entry]));

  for (const mobileListing of mobile) {
    let match: CarsBgSyncListing | null = null;

    if (mobileListing.carsId) {
      match = carsById.get(mobileListing.carsId) ?? null;
      if (match) {
        matchedCars.add(match.id);
      }
    }

    if (!match) {
      let best: { listing: CarsBgSyncListing; score: number } | null = null;

      for (const carsListing of cars) {
        if (matchedCars.has(carsListing.id)) continue;

        let score = 0;
        const mobileMake = normalizeLabel(mobileListing.make || '');
        const carsMake = normalizeLabel(carsListing.make || '');
        const mobileModel = normalizeLabel(mobileListing.model || '');
        const carsModel = normalizeLabel(carsListing.model || '');
        const carsFull = normalizeLabel(carsListing.fullTitle);
        const mobileFull = normalizeLabel(mobileListing.fullTitle);

        if (mobileMake && carsMake) {
          if (mobileMake === carsMake) score += 2;
          else if (carsFull.includes(mobileMake) || mobileFull.includes(carsMake)) score += 1;
          else score -= 2;
        }

        if (mobileModel && carsModel) {
          if (mobileModel === carsModel) score += 2;
          else if (carsFull.includes(mobileModel) || mobileFull.includes(carsModel)) score += 1;
          else score -= 3;
        }

        if (mobileListing.price.amount != null && carsListing.price.amount != null) {
          if (Number(mobileListing.price.amount) === Number(carsListing.price.amount)) score += 2;
          else {
            const priceDiff = Math.abs(Number(mobileListing.price.amount) - Number(carsListing.price.amount));
            if (priceDiff <= 500) score += 1;
          }
        }

        if (mobileListing.year && carsListing.year) {
          if (mobileListing.year === carsListing.year) score += 2;
          else continue;
        }

        if (mobileListing.mileage != null && carsListing.mileage != null) {
          const diff = Math.abs(Number(mobileListing.mileage) - Number(carsListing.mileage));
          if (diff === 0) score += 3;
          else if (diff <= 1000) score += 2;
          else if (diff <= 5000) score += 1;
          else continue;
        }

        if (mobileListing.fuel && carsListing.fuel) {
          if (mobileListing.fuel === carsListing.fuel) score += 1;
          else continue;
        }

        if (mobileListing.category && carsListing.category) {
          if (mobileListing.category === carsListing.category) score += 1;
        }

        score += Math.min(1, titleOverlapScore(mobileListing.fullTitle, carsListing.fullTitle));

        if (!best || score > best.score) best = { listing: carsListing, score };
      }

      if (best && best.score >= 4) {
        match = best.listing;
        matchedCars.add(match.id);
      }
    }

    if (!match) {
      missing.push(mobileListing);
      continue;
    }

    const priceDiff = mobileListing.price.amount != null
      && match.price.amount != null
      && Number(mobileListing.price.amount) !== Number(match.price.amount);
    const targetTitle = getCarsBgTitleValue(mobileListing);
    const titleDiff = Boolean(
      targetTitle &&
      normalizeLabel(targetTitle) !== normalizeLabel(match.title),
    );
    const targetDescription = normalizeCompareText(mobileListing.description);
    const currentDescription = normalizeCompareText(match.description);
    const descriptionDiff = Boolean(
      targetDescription &&
      currentDescription &&
      targetDescription !== currentDescription,
    );

    if (priceDiff || titleDiff || descriptionDiff) {
      diffs.push({ mobileBg: mobileListing, carsBg: match, priceDiff, titleDiff, descriptionDiff });
    }
  }

  return {
    missing,
    diffs,
    staleCarsIds: [],
  };
}

export async function deleteCarsBgOffer(page: Page, offerId: string): Promise<boolean> {
  await page.goto(`${CARS_BG_BASE_URL}/delete_offer.php?id=${offerId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const confirmButton = await page.$('button[type="submit"], input[type="submit"], a[data-action*="delete"], a[href*="confirm"]').catch(() => null);
  if (confirmButton) {
    await confirmButton.click().catch(() => {});
    await page.waitForTimeout(1500);
    return true;
  }
  await page.evaluate(async ({ offer, baseUrl }) => {
    await fetch(`${baseUrl}/delete_offer.php?id=${offer}&confirm=1`, {
      method: 'POST',
      credentials: 'include',
    });
  }, { offer: offerId, baseUrl: CARS_BG_BASE_URL }).catch(() => {});
  const bodyText = await page.textContent('body').catch(() => '');
  return bodyText.includes('изтрита') || bodyText.includes('deleted') || bodyText.includes('успешно');
}

export async function updateListingPrice(page: Page, offerUrlOrId: string, newPrice: number): Promise<boolean> {
  const offerId = extractOfferId(offerUrlOrId);
  if (!offerId) return false;

  await page.goto(buildCarsBgEditUrl(offerId), { waitUntil: 'domcontentloaded' });
  await prepareCarsBgPage(page);

  const priceInput = page.locator('input[name="price"], input[name*="price"], input[id*="price"]').first();
  if (!(await priceInput.count())) return false;

  await priceInput.fill('');
  await priceInput.type(String(newPrice), { delay: 20 });

  const submitSelectors = [
    '#publishBtn',
    'button[type="submit"]',
    'input[type="submit"]',
    'a.btn-thick',
    'button:has-text("Запази")',
    'button:has-text("Промени")',
  ];

  let clicked = false;
  for (const selector of submitSelectors) {
    const button = page.locator(selector).first();
    if (await button.count()) {
      await button.click().catch(() => {});
      clicked = true;
      break;
    }
  }

  if (!clicked) {
    await page.locator('form').first().evaluate((form) => form.submit()).catch(() => {});
  }

  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);

  const errorText = await page.$$eval('.error', (nodes) => nodes.map((node) => node.textContent?.trim()).filter(Boolean).join(' | ')).catch(() => '');
  const persistedValue = await priceInput.inputValue().catch(() => '');
  const bodyText = await page.textContent('body').catch(() => '');
  const navigatedAway = !page.url().includes('editcar.php');
  return !errorText && (persistedValue === String(newPrice) || bodyText.includes(String(newPrice)) || navigatedAway);
}

function getCarsBgTitleValue(listing: CarsBgSyncListing): string {
  return (listing.carsbgTitle || listing.title || listing.fullTitle || '').trim();
}

export async function updateListingContent(page: Page, offerUrlOrId: string, listing: CarsBgSyncListing): Promise<boolean> {
  const offerId = extractOfferId(offerUrlOrId);
  if (!offerId) return false;

  await page.goto(buildCarsBgEditUrl(offerId), { waitUntil: 'domcontentloaded' });
  await prepareCarsBgPage(page);

  const targetTitle = getCarsBgTitleValue(listing);
  const notes = listing.description || listing.fullTitle;

  const titleInput = page.locator('#engine, input[name="engine"], input[id*="engine"]').first();
  if (targetTitle && await titleInput.count()) {
    await titleInput.fill('');
    await titleInput.type(targetTitle, { delay: 20 });
  }

  const notesInput = page.locator('#notes, textarea[name="notes"], textarea[id*="notes"]').first();
  if (notes && await notesInput.count()) {
    await notesInput.fill('');
    await notesInput.type(notes.slice(0, 32000), { delay: 5 });
  }

  const submitSelectors = [
    '#publishBtn',
    'button[type="submit"]',
    'input[type="submit"]',
    'a.btn-thick',
    'button:has-text("Запази")',
    'button:has-text("Промени")',
  ];

  let clicked = false;
  for (const selector of submitSelectors) {
    const button = page.locator(selector).first();
    if (await button.count()) {
      await button.click().catch(() => {});
      clicked = true;
      break;
    }
  }

  if (!clicked) {
    await page.locator('form').first().evaluate((form) => form.submit()).catch(() => {});
  }

  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);

  const errorText = await page.$$eval('.error', (nodes) => nodes.map((node) => node.textContent?.trim()).filter(Boolean).join(' | ')).catch(() => '');
  const persistedTitle = await titleInput.inputValue().catch(() => '');
  const persistedNotes = await notesInput.inputValue().catch(() => '');
  const bodyText = await page.textContent('body').catch(() => '');
  const navigatedAway = !page.url().includes('editcar.php');

  return !errorText && (
    navigatedAway ||
    (targetTitle ? normalizeLabel(persistedTitle) === normalizeLabel(targetTitle) : true) &&
    (notes ? normalizeCompareText(persistedNotes).includes(normalizeCompareText(notes).slice(0, 32)) || normalizeCompareText(bodyText).includes(normalizeCompareText(notes).slice(0, 32)) : true)
  );
}

export async function createListing(page: Page, listing: CarsBgSyncListing, dealerSlug: string): Promise<{ success: boolean; url?: string; offerId?: string | null }> {
  if (!optionSets) return { success: false };
  if (!listing.price.amount) return { success: false };

  await page.goto(`${CARS_BG_BASE_URL}/publishcar.php?fromothersection=1`, { waitUntil: 'domcontentloaded' });
  await prepareCarsBgPage(page);

  const brand = inferBrandFromTitle(listing.fullTitle);
  if (!brand) return { success: false };

  await selectRadio(page, 'stateId', 1);
  const condition = findOptionByLabel(optionSets.condition, 'В добро състояние');
  if (condition) await selectRadio(page, 'conditionId', condition.id);
  await selectRadio(page, 'brandId', brand.id);

  const modelOptions = await fetchModelOptions(brand.id);
  const model = inferModelFromTitle(listing.fullTitle, brand.label, modelOptions);
  if (model) {
    await page.evaluate((brandId) => {
      const toggle = (window as Window & { toggleModelSelect?: (id: string) => void }).toggleModelSelect;
      if (typeof toggle === 'function') toggle(String(brandId));
    }, brand.id).catch(() => {});
    await page.waitForSelector(`#modelId_${model.id}`, { timeout: 15000 }).catch(() => {});
    await selectRadio(page, 'modelId', model.id);
  }

  const category = mapCategory(listing.category);
  if (category) await selectRadio(page, 'categoryId', category.id);

  await fillInput(page, '#engine', getCarsBgTitleValue(listing));
  await fillInput(page, '#price', listing.price.amount);
  await selectRadio(page, 'currencyId', currencyIdFromCode(listing.price.currency));

  const gear = mapGear(listing.transmission);
  if (gear) await selectRadio(page, 'gearId', gear.id);

  const fuel = mapFuel(listing.fuel);
  if (fuel) await selectRadio(page, 'fuelId', fuel.id);

  if (listing.power) await fillInput(page, '#power', listing.power);
  if (listing.year) {
    await selectRadio(page, 'production_year', listing.year);
    if (listing.month) {
      const monthNumber = Number.parseInt(listing.month, 10);
      if (Number.isFinite(monthNumber) && monthNumber >= 1 && monthNumber <= 12) {
        await selectRadio(page, 'monthId', monthNumber);
      } else {
        await selectRadio(page, 'monthId', 6);
      }
    } else {
      await selectRadio(page, 'monthId', 6);
    }
  }

  if (listing.mileage) await fillInput(page, '#run', listing.mileage);
  await selectRadio(page, 'doorId', mapDoors(listing.category));

  const color = mapColor(listing.color);
  if (color) await selectRadio(page, 'colorId', color.id);

  await selectRadio(page, 'is_inbg', 1);
  await fillTextarea(page, '#notes', listing.description || listing.fullTitle);

  if (listing.carsBgExtras?.selected?.length) {
    await applyCarsBgExtras(page, listing.carsBgExtras).catch(() => {});
  }

  let tempDir: string | null = null;
  try {
    const { dir, files } = await downloadImages(listing.images || [], `${dealerSlug}-${Date.now()}`);
    tempDir = dir;
    if (files.length) await uploadImages(page, files);
  } finally {
    if (tempDir) await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
  await page.waitForTimeout(500);
  await page.click('#publishBtn').catch(() => {});

  let success = false;
  try {
    await page.waitForFunction(() => window.location.href.includes('/offer/'), { timeout: 45000 });
    success = true;
  } catch {
    success = false;
  }

  const finalUrl = page.url();
  return success ? { success: true, url: finalUrl, offerId: extractOfferId(finalUrl) } : { success: false };
}

export async function planCarsBgDealerSync(db: Database.Database, dealer: CarsBgDealerAccount): Promise<CarsBgSyncPlan> {
  const mobileListings = loadDealerMobileListings(db, dealer.id);
  const carsListings = loadDealerCarsListings(db, dealer.id);
  const plan = compareListings(mobileListings, carsListings);
  plan.staleCarsIds = getStaleCarsBgListings(db, dealer.slug);
  return plan;
}

export async function syncCarsBgDealer(
  db: Database.Database,
  dealer: CarsBgDealerAccount,
  options?: {
    dryRun?: boolean;
    logger?: (message: string) => void;
  },
): Promise<CarsBgSyncDealerResult> {
  const logger = options?.logger ?? (() => {});
  const plan = await planCarsBgDealerSync(db, dealer);

  logger(`Cars.bg sync plan for ${dealer.slug}: ${plan.missing.length} missing, ${plan.diffs.length} diffs, ${plan.staleCarsIds.length} stale`);

  const result: CarsBgSyncDealerResult = {
    ...plan,
    updated: 0,
    created: 0,
    deleted: 0,
    failedUpdates: 0,
    failedCreates: 0,
    failedDeletes: 0,
    dryRun: options?.dryRun !== false,
  };

  if (result.dryRun || (!plan.missing.length && !plan.diffs.length && !plan.staleCarsIds.length)) {
    return result;
  }

  if (!dealer.carsUser || !dealer.carsPassword) {
    throw new Error(`Dealer ${dealer.slug} is missing cars.bg credentials`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const loggedIn = await loginToCarsBg(page, dealer.carsUser, dealer.carsPassword);
    if (!loggedIn) throw new Error(`Cars.bg login failed for ${dealer.slug}`);

    for (const diff of plan.diffs) {
      const targetId = diff.mobileBg.carsId || diff.carsBg.carsId || extractOfferId(diff.carsBg.url);
      if (!targetId) {
        result.failedUpdates++;
        continue;
      }
      const updateParts: string[] = [];
      let ok = true;
      if (diff.priceDiff && diff.mobileBg.price.amount != null) {
        updateParts.push(`price €${diff.carsBg.price.amount ?? '—'} -> €${diff.mobileBg.price.amount}`);
        ok = ok && await updateListingPrice(page, targetId, diff.mobileBg.price.amount);
      }
      if (diff.titleDiff || diff.descriptionDiff) {
        const changedFields = [
          diff.titleDiff ? 'title' : null,
          diff.descriptionDiff ? 'description' : null,
        ].filter(Boolean).join('/');
        updateParts.push(changedFields);
        ok = ok && await updateListingContent(page, targetId, diff.mobileBg);
      }
      logger(`Updating cars.bg ${updateParts.join(', ')} for ${diff.mobileBg.fullTitle}`);
      if (ok) {
        result.updated++;
      } else {
        result.failedUpdates++;
      }
    }

    for (const carsId of plan.staleCarsIds) {
      logger(`Deleting stale cars.bg offer ${carsId}`);
      const deleted = await deleteCarsBgOffer(page, carsId);
      if (deleted) {
        clearCarsId(db, carsId);
        result.deleted++;
      } else {
        result.failedDeletes++;
      }
    }

    for (const listing of plan.missing) {
      logger(`Publishing missing cars.bg listing ${listing.fullTitle}`);
      const created = await createListing(page, listing, dealer.slug);
      if (created.success && created.offerId && listing.mobileId) {
        saveCarsId(db, listing.mobileId, created.offerId);
        result.created++;
      } else {
        result.failedCreates++;
      }
    }
  } finally {
    await browser.close();
  }

  return result;
}
