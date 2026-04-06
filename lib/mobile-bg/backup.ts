import fsp from 'fs/promises';
import path from 'path';
import type Database from 'better-sqlite3';
import { chromium, type Page } from 'playwright';
import { loginMobileBg } from '@/lib/mobile-bg/auth';
import { USER_AGENT } from '@/lib/mobile-bg/constants';
import { fetchMakesModels, parseMakeModelSync, type MakesMap } from '@/lib/mobile-bg/makes-models';
import { captureEditFormSnapshotWithPage } from '@/lib/mobile-bg/edit-form-capture';
import { reconcileDeletedMobileBgListings } from '@/lib/mobile-bg/reconcile-deleted';
import type { VatValue } from '@/lib/vat';

export interface DealerBackupConfig {
  id: number;
  slug: string;
  name: string;
  own?: boolean;
  mobileUrl: string;
  mobileUser: string;
  mobilePassword: string;
}

interface ScrapedDetail {
  mobileId: string;
  url: string;
  sourceTitle: string;
  make: string;
  model: string;
  title: string;
  priceAmount: number | null;
  priceCurrency: string;
  vat: VatValue | null;
  year: number | null;
  mileage: number | null;
  fuel: string | null;
  power: number | null;
  engine: string | null;
  color: string | null;
  transmission: string | null;
  category: string | null;
  description: string;
  phones: string[];
  extras: Record<string, Array<{ label: string; alias: string | null }>>;
  techData: Record<string, string>;
  photoOrder: string[];
  photoThumbUrls: string[];
  imageUrls: string[];
}

interface SavedImage {
  filename: string;
  url: string;
  localPath: string;
}

interface ExistingBackupRow {
  id: number;
}

export interface BackupDealerResult {
  runId: number;
  listingsCount: number;
  imagesCount: number;
}

export interface BackupProgressEvent {
  type: 'status' | 'listing' | 'complete';
  dealer?: string;
  message?: string;
  total?: number;
  current?: number;
  action?: 'created' | 'updated';
  mobileId?: string;
  make?: string;
  model?: string;
  title?: string;
  url?: string;
  previewUrl?: string;
  imageCount?: number;
  views?: number | null;
  watching?: number | null;
  adStatus?: 'TOP' | 'VIP' | 'none';
  runId?: number;
  listingsCount?: number;
  imagesCount?: number;
}

export function getStorageRoot(dbPath: string): string {
  return path.join(path.dirname(dbPath), 'mobilebg-backups');
}

async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

async function collectListingLinks(page: Page, dealerUrl: string, maxPages = 30): Promise<string[]> {
  const links = new Set<string>();

  for (let currentPage = 1; currentPage <= maxPages; currentPage += 1) {
    const url = new URL(dealerUrl);
    if (currentPage > 1) url.searchParams.set('page', String(currentPage));

    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('a[href*="/obiava-"]', { timeout: 15000 }).catch(() => {});

    const pageLinks = await page.$$eval('a[href*="/obiava-"]', (elements) =>
      [...new Set(
        elements
          .map((el) => (el as HTMLAnchorElement).href)
          .filter((href) => href.includes('/obiava-')),
      )],
    );

    pageLinks.forEach((href) => links.add(href));

    const hasNext = await page.evaluate(
      (pageNo) =>
        Array.from(document.querySelectorAll('a')).some((a) =>
          a.href.includes(`page=${pageNo + 1}`) || a.textContent?.trim() === String(pageNo + 1),
        ),
      currentPage,
    ).catch(() => false);

    if (!hasNext) break;
  }

  return [...links];
}

async function scrapeAllImages(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const normalizeUrl = (value: string) => {
      if (!value) return '';
      try {
        return new URL(value, window.location.href).toString();
      } catch {
        return '';
      }
    };
    const toFullSizeUrl = (source: string) =>
      source
        .replace(/(\/mobile\/photosorg\/\d+)\/(\d+)\/(?!big1)/, '$1/$2/big1/')
        .replace(/\/1\/big1\/big1\//, '/1/big1/');

    const galleryEls = document.querySelectorAll('.smallPicturesGallery img, .smallPicturesGallery [data-lazy], .smallPicturesGallery [data-src]');
    if (galleryEls.length > 0) {
      const seen = new Set<string>();
      const imgs: string[] = [];
      galleryEls.forEach((el) => {
        const source = normalizeUrl(
          el.getAttribute('data-src-gallery') ||
            el.getAttribute('data-lazy') ||
            el.getAttribute('data-src') ||
            (el as HTMLImageElement).src ||
            '',
        );
        const bigSource = toFullSizeUrl(source);
        const canonical = bigSource.includes('/big1/') ? bigSource : source;
        if (canonical && !seen.has(canonical) && canonical.includes('photosorg')) {
          seen.add(canonical);
          imgs.push(canonical);
        }
      });
      if (imgs.length > 0) return imgs;
    }

    const seen = new Set<string>();
    const imgs: string[] = [];
    document.querySelectorAll('img, [data-lazy], [data-src]').forEach((el) => {
      const source = normalizeUrl(
        el.getAttribute('data-src-gallery') ||
          el.getAttribute('data-lazy') ||
          el.getAttribute('data-src') ||
          (el as HTMLImageElement).src ||
          '',
      );
      if (!source) return;
      const canonical = toFullSizeUrl(source);
      if (seen.has(canonical)) return;
      const isCarPhoto = canonical.includes('/big1/') && /\.(webp|jpg|jpeg|png)(\?|$)/i.test(canonical);
      if (isCarPhoto) {
        seen.add(canonical);
        imgs.push(canonical);
      }
    });
    if (imgs.length > 0) return imgs;

    const html = document.documentElement.innerHTML;
    const regex = /https?:\/\/[^"'\\\s]+\/photosorg\/[^"'\\\s]+\/big1\/[^"'\\\s]+\.(?:webp|jpg|jpeg|png)(?:\?[^"'\\\s]*)?/gi;
    const htmlMatches = html.match(regex) || [];
    for (const rawUrl of htmlMatches) {
      const canonical = normalizeUrl(rawUrl);
      if (!canonical || seen.has(canonical)) continue;
      seen.add(canonical);
      imgs.push(canonical);
    }
    return imgs;
  });
}

function normalizeImageUrl(value: string): string | null {
  if (!value) return null;

  try {
    return new URL(value).toString();
  } catch {
    try {
      return new URL(value, 'https://www.mobile.bg').toString();
    } catch {
      return null;
    }
  }
}

function toMobileBgFullImageUrl(value: string): string | null {
  const normalized = normalizeImageUrl(value);
  if (!normalized) return null;
  return normalized
    .replace(/(\/mobile\/photosorg\/\d+)\/(\d+)\/(?!big1)/, '$1/$2/big1/')
    .replace(/\/(\d+)\/big1\/big1\//, '/$1/big1/');
}

async function scrapeListingDetail(page: Page, url: string, makesMap: MakesMap | null): Promise<ScrapedDetail> {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('h1', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);

  const data = await page.evaluate(() => {
    const normalizeCategoryValue = (value: string | null) => {
      if (!value) return null;
      return value
        .split(/\r?\n/)[0]
        .replace(/\s+(Пробег|Цвят|Скоростна кутия|Двигател|Мощност|Кубатура).*$/i, '')
        .trim() || null;
    };

    const body = document.body.innerText;
    const title = document.querySelector('h1')?.textContent?.trim() || '';
    const priceMatch = body.match(/([\d\s.,]+)\s*€/);
    const noVat = body.includes('Не се начислява ДДС');
    const hasVat = !noVat && body.includes('начислява ДДС');
    const readTechDataValue = (label: string) => {
      const rows = Array.from(document.querySelectorAll('.techData .items .item'));
      for (const row of rows) {
        const divs = row.querySelectorAll('div');
        if (divs.length < 2) continue;
        if (divs[0].textContent?.trim() === label) {
          return divs[1].textContent?.trim() || null;
        }
      }
      return null;
    };

    const extract = (pattern: RegExp) => {
      const match = body.match(pattern);
      return match ? match[1].trim() : null;
    };

    const year = extract(/Дата на производство\s+(.+?)(?:\n|Двигател)/);
    const fuel = extract(/Двигател\s+(\S+)/);
    const power = extract(/Мощност\s+([\d]+)/);
    const engine = extract(/Кубатура[^)]*\)\s*([\d]+)/);
    const transmission = extract(/Скоростна кутия\s+(\S+)/);
    const categoryFromTechData = readTechDataValue('Категория');
    const categoryRaw = categoryFromTechData || extract(/Категория\s+(.+?)(?:\n|Пробег|Цвят|$)/);
    const category = normalizeCategoryValue(categoryRaw);
    const mileageFromTechData = readTechDataValue('Пробег');
    const mileageMatch = (mileageFromTechData || body).match(/([\d\s]+)\s*км/);
    const mileage = mileageMatch ? mileageMatch[1].replace(/\s/g, '').trim() : null;
    const color = extract(/Цвят\s+(\S+(?:\s+\S+)?)/);
    const descMatch = body.match(/Допълнителна информация\s*([\s\S]*?)(?:Виж всички обяви|Контакти с продавача|$)/);
    const description = descMatch ? descMatch[1].trim() : '';
    const listingId = window.location.href.match(/obiava-(\d+)/)?.[1] || null;
    const phoneMatch = body.match(/тел[.\s]*([0-9\s+\-()]{8,20})/gi);
    const phones = phoneMatch ? phoneMatch.map((p) => p.replace(/тел[.\s]*/i, '').trim()) : [];

    const extras: Record<string, Array<{ label: string; alias: string | null }>> = {};
    const extriEl = document.querySelector('.carExtri');
    if (extriEl) {
      let currentCategory: string | null = null;
      for (const child of Array.from(extriEl.childNodes)) {
        if (child.nodeType !== 1) continue;
        const element = child as HTMLElement;
        if (element.tagName === 'SPAN' && element.classList.contains('Title')) {
          currentCategory = element.textContent?.trim() || null;
          if (currentCategory) extras[currentCategory] = [];
        } else if (element.tagName === 'DIV' && element.classList.contains('items') && currentCategory) {
          extras[currentCategory] = Array.from(element.querySelectorAll('div')).map((el) => ({
            label: el.textContent?.trim() || '',
            alias: el.getAttribute('data-title') || null,
          }));
        }
      }
    }

    const techData: Record<string, string> = {};
    document.querySelectorAll('.techData .items .item').forEach((item) => {
      const divs = item.querySelectorAll('div');
      if (divs.length >= 2) {
        techData[divs[0].textContent?.trim() || ''] = divs[1].textContent?.trim() || '';
      }
    });

    const photoOrder = Array.from(document.querySelectorAll('.smallPicturesGallery img, .smallPicturesGallery [data-lazy], .smallPicturesGallery [data-src]'))
      .map((el) => {
        const source = (el as HTMLImageElement).src || el.getAttribute('data-lazy') || el.getAttribute('data-src') || '';
        const keyMatch = source.match(/_([^_/]+)\.webp/);
        return keyMatch ? keyMatch[1] : null;
      })
      .filter((value): value is string => Boolean(value));

    const photoThumbUrls = Array.from(document.querySelectorAll('.smallPicturesGallery img, .smallPicturesGallery [data-lazy], .smallPicturesGallery [data-src]'))
      .map((el) => (el as HTMLImageElement).src || el.getAttribute('data-lazy') || el.getAttribute('data-src') || '')
      .filter((value): value is string => Boolean(value));

    return {
      title,
      price: priceMatch ? priceMatch[1].replace(/\s/g, '').replace(',', '.') : null,
      noVat,
      hasVat,
      year,
      fuel,
      power,
      engine,
      transmission,
      category,
      mileage,
      color,
      description,
      listingId,
      phones,
      extras,
      techData,
      photoOrder,
      photoThumbUrls,
    };
  });

  const scrapedImageUrls = await scrapeAllImages(page);
  const mobileId = url.match(/obiava-(\d+)/)?.[1] || data.listingId || String(Date.now());
  const imageUrls = scrapedImageUrls.length > 0
    ? scrapedImageUrls
    : data.photoThumbUrls
      .map((thumbUrl) => toMobileBgFullImageUrl(thumbUrl))
      .filter((value): value is string => Boolean(value));
  const cleanedTitle = data.title.replace(/\s*Обява:\s*\d+\s*$/i, '').trim();
  const parsed = parseMakeModelSync(cleanedTitle, makesMap);

  return {
    mobileId,
    url,
    sourceTitle: cleanedTitle,
    make: parsed.make,
    model: parsed.model,
    title: parsed.titleRemainder.replace(/\s*Обява:\s*\d+\s*$/i, '').trim(),
    priceAmount: data.price ? parseFloat(data.price) : null,
    priceCurrency: 'EUR',
    vat: data.hasVat ? 'included' : data.noVat ? 'exempt' : null,
    year: data.year ? parseInt(data.year.match(/\d{4}/)?.[0] || '', 10) || null : null,
    mileage: data.mileage ? parseInt(data.mileage, 10) || null : null,
    fuel: data.fuel || null,
    power: data.power ? parseInt(data.power, 10) || null : null,
    engine: data.engine ? `${data.engine} см³` : null,
    color: data.color || null,
    transmission: data.transmission || null,
    category: data.category || null,
    description: data.description,
    phones: data.phones,
    extras: data.extras,
    techData: data.techData,
    photoOrder: data.photoOrder,
    photoThumbUrls: data.photoThumbUrls,
    imageUrls,
  };
}

async function downloadAllImages(urls: string[], destDir: string): Promise<SavedImage[]> {
  const saved: SavedImage[] = [];
  const validUrls = urls
    .map((url) => normalizeImageUrl(url))
    .filter((url): url is string => Boolean(url))
    .filter((url) => {
    if (!url) return false;
    if (!/\.(webp|jpg|jpeg|png)(\?|$)/i.test(url)) return false;
    if (!url.includes('/big1/') && !url.includes('/snimka/')) return false;
    return true;
    });

  for (let i = 0; i < validUrls.length; i += 1) {
    const imageUrl = validUrls[i];
    const filename = `${String(i + 1).padStart(2, '0')}.webp`;
    const localPath = path.join(destDir, filename);

    try {
      const existingStat = await fsp.stat(localPath);
      if (existingStat.isFile() && existingStat.size > 0) {
        saved.push({ filename, url: imageUrl, localPath });
        continue;
      }
    } catch {
      // File missing, continue with download.
    }

    try {
      const res = await fetch(imageUrl, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      await fsp.writeFile(localPath, buf);
      saved.push({ filename, url: imageUrl, localPath });
    } catch {
      // best-effort; keep the backup run moving
    }
  }

  return saved;
}

function createBackupRun(db: Database.Database, dealerId: number, sourceUrl: string): number {
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO mobilebg_backup_runs (dealer_id, status, source_url, listings_count, images_count, started_at, created_at, updated_at)
    VALUES (?, 'running', ?, 0, 0, ?, ?, ?)
  `).run(dealerId, sourceUrl, now, now, now);
  return Number(result.lastInsertRowid);
}

function clearBackupImages(db: Database.Database, backupId: number): void {
  db.prepare(`DELETE FROM mobilebg_backup_images WHERE backup_id = ?`).run(backupId);
}

function deleteDuplicateBackups(db: Database.Database, canonicalId: number, duplicateIds: number[]): void {
  if (duplicateIds.length === 0) return;

  const placeholders = duplicateIds.map(() => '?').join(', ');
  db.prepare(`UPDATE mobilebg_edit_form_snapshots SET backup_id = ? WHERE backup_id IN (${placeholders})`).run(canonicalId, ...duplicateIds);
  db.prepare(`UPDATE mobilebg_repost_jobs SET backup_id = ? WHERE backup_id IN (${placeholders})`).run(canonicalId, ...duplicateIds);
  db.prepare(`DELETE FROM mobilebg_backup_images WHERE backup_id IN (${placeholders})`).run(...duplicateIds);
  db.prepare(`DELETE FROM mobilebg_backups WHERE id IN (${placeholders})`).run(...duplicateIds);
}

export function dedupeMobileBgBackups(db: Database.Database, dealerId?: number): number {
  const duplicateGroups = db.prepare(`
    SELECT dealer_id, mobile_id
    FROM mobilebg_backups
    ${dealerId == null ? '' : 'WHERE dealer_id = ?'}
    GROUP BY dealer_id, mobile_id
    HAVING COUNT(*) > 1
  `).all(...(dealerId == null ? [] : [dealerId])) as Array<{ dealer_id: number; mobile_id: string }>;

  let deletedCount = 0;

  for (const group of duplicateGroups) {
    const rows = db.prepare(`
      SELECT id
      FROM mobilebg_backups
      WHERE dealer_id = ? AND mobile_id = ?
      ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
    `).all(group.dealer_id, group.mobile_id) as ExistingBackupRow[];

    const canonical = rows[0];
    const duplicateIds = rows.slice(1).map((row) => row.id);
    if (!canonical || duplicateIds.length === 0) continue;

    deleteDuplicateBackups(db, canonical.id, duplicateIds);
    deletedCount += duplicateIds.length;
  }

  return deletedCount;
}

function upsertBackupArtifact(
  db: Database.Database,
  runId: number,
  dealerId: number,
  detail: ScrapedDetail,
): { backupId: number; action: 'created' | 'updated' } {
  const now = new Date().toISOString();
  const listingRow = db.prepare(`
    SELECT id, ad_status, kaparo
    FROM listings
    WHERE mobile_id = ?
    LIMIT 1
  `).get(detail.mobileId) as { id?: number; ad_status?: string | null; kaparo?: number | null } | undefined;
  const existing = db.prepare(`
    SELECT id
    FROM mobilebg_backups
    WHERE dealer_id = ? AND mobile_id = ?
    ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
  `).all(dealerId, detail.mobileId) as ExistingBackupRow[];

  const canonical = existing[0];
  const duplicateIds = existing.slice(1).map((row) => row.id);

  if (canonical) {
    if (duplicateIds.length > 0) {
      deleteDuplicateBackups(db, canonical.id, duplicateIds);
    }

    db.prepare(`
      UPDATE mobilebg_backups
      SET
        run_id = ?, listing_id = ?, source_url = ?, source_title = ?, phones_json = ?, extras_json = ?, tech_data_json = ?,
        photo_order_json = ?, image_count = 0, updated_at = ?
      WHERE id = ?
    `).run(
      runId,
      listingRow?.id ?? null,
      detail.url,
      detail.sourceTitle,
      JSON.stringify(detail.phones),
      JSON.stringify(detail.extras),
      JSON.stringify(detail.techData),
      JSON.stringify(detail.photoOrder),
      now,
      canonical.id,
    );

    clearBackupImages(db, canonical.id);
    return { backupId: canonical.id, action: 'updated' };
  }

  const result = db.prepare(`
    INSERT INTO mobilebg_backups (
      run_id, dealer_id, listing_id, mobile_id, source_url, source_title, make, model, title,
      price_amount, price_currency, vat_included, year, mileage, fuel, power, engine, color, transmission, category,
      description, ad_status, kaparo, draft_needs_sync, last_mobile_sync_at,
      phones_json, extras_json, tech_data_json, photo_order_json, image_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    runId,
    dealerId,
    listingRow?.id ?? null,
    detail.mobileId,
    detail.url,
    detail.sourceTitle,
    detail.make,
    detail.model,
    detail.title,
    detail.priceAmount,
    detail.priceCurrency,
    detail.vat,
    detail.year,
    detail.mileage,
    detail.fuel,
    detail.power,
    detail.engine,
    detail.color,
    detail.transmission,
    detail.category,
    detail.description,
    listingRow?.ad_status ?? 'none',
    listingRow?.kaparo ?? 0,
    0,
    null,
    JSON.stringify(detail.phones),
    JSON.stringify(detail.extras),
    JSON.stringify(detail.techData),
    JSON.stringify(detail.photoOrder),
    0,
    now,
    now,
  );

  return { backupId: Number(result.lastInsertRowid), action: 'created' };
}

function insertBackupImages(db: Database.Database, backupId: number, savedImages: SavedImage[]): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO mobilebg_backup_images (backup_id, sort_order, filename, source_url, local_path, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < savedImages.length; i += 1) {
    const image = savedImages[i];
    stmt.run(backupId, i, image.filename, image.url, image.localPath, now);
  }

  db.prepare(`UPDATE mobilebg_backups SET image_count = ?, updated_at = ? WHERE id = ?`).run(savedImages.length, now, backupId);
}

export async function backupDealerToDb(
  db: Database.Database,
  dealer: DealerBackupConfig,
  dbPath: string,
  onProgress?: (event: BackupProgressEvent) => void,
): Promise<BackupDealerResult> {
  const storageRoot = getStorageRoot(dbPath);
  const dealerRoot = path.join(storageRoot, dealer.slug);
  await ensureDir(dealerRoot);
  dedupeMobileBgBackups(db, dealer.id);

  const runId = createBackupRun(db, dealer.id, dealer.mobileUrl);
  onProgress?.({ type: 'status', dealer: dealer.name, message: 'Starting backup run', runId });
  const makesMap = await fetchMakesModels().catch(() => null);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  try {
    onProgress?.({ type: 'status', dealer: dealer.name, message: 'Logging into mobile.bg', runId });
    const loggedIn = await loginMobileBg(page, dealer.mobileUser, dealer.mobilePassword);
    if (!loggedIn) {
      throw new Error(`Login failed for ${dealer.slug}`);
    }

    onProgress?.({ type: 'status', dealer: dealer.name, message: 'Collecting dealer listings', runId });
    const links = await collectListingLinks(page, dealer.mobileUrl);
    const seenMobileIds = links
      .map((link) => link.match(/obiava-(\d+)/)?.[1] || null)
      .filter((value): value is string => Boolean(value));
    onProgress?.({
      type: 'status',
      dealer: dealer.name,
      message: `Found ${links.length} listings to save`,
      runId,
      total: links.length,
    });
    let imageCount = 0;

    for (let index = 0; index < links.length; index += 1) {
      const link = links[index];
      const detail = await scrapeListingDetail(page, link, makesMap);
      const listingDir = path.join(dealerRoot, detail.mobileId);
      await ensureDir(listingDir);
      const { backupId, action } = upsertBackupArtifact(db, runId, dealer.id, detail);
      const savedImages = await downloadAllImages(detail.imageUrls, listingDir);
      insertBackupImages(db, backupId, savedImages);
      let engagement: { views: number | null; watching: number | null; adStatus: 'TOP' | 'VIP' | 'none' } | null = null;
      try {
        engagement = await captureEditFormSnapshotWithPage(db, dealer, detail.mobileId, dbPath, page, {
          backupId,
        });
      } catch (error) {
        onProgress?.({
          type: 'status',
          dealer: dealer.name,
          runId,
          message: `Could not capture edit-form values for ${detail.mobileId}: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
      imageCount += savedImages.length;
      onProgress?.({
        type: 'listing',
        dealer: dealer.name,
        runId,
        current: index + 1,
        total: links.length,
        action,
        mobileId: detail.mobileId,
        make: detail.make,
        model: detail.model,
        title: detail.title || detail.sourceTitle,
        url: detail.url,
        previewUrl: detail.imageUrls[0] || undefined,
        imageCount: savedImages.length,
        views: engagement?.views ?? null,
        watching: engagement?.watching ?? null,
        adStatus: engagement?.adStatus ?? 'none',
      });
    }

    if (dealer.own) {
      const reconciliation = reconcileDeletedMobileBgListings(db, dealer.id, seenMobileIds);
      onProgress?.({
        type: 'status',
        dealer: dealer.name,
        runId,
        message: `Reconciled own mobile.bg listings: reactivated ${reconciliation.reactivatedCount}, marked ${reconciliation.deletedCount} deleted`,
      });
    }

    const finishedAt = new Date().toISOString();
    db.prepare(`
      UPDATE mobilebg_backup_runs
      SET status = 'completed', listings_count = ?, images_count = ?, finished_at = ?, updated_at = ?
      WHERE id = ?
    `).run(links.length, imageCount, finishedAt, finishedAt, runId);

    const result = { runId, listingsCount: links.length, imagesCount: imageCount };
    onProgress?.({
      type: 'complete',
      dealer: dealer.name,
      message: `Saved ${links.length} listings and ${imageCount} images`,
      ...result,
    });
    return result;
  } catch (error) {
    const failedAt = new Date().toISOString();
    db.prepare(`
      UPDATE mobilebg_backup_runs
      SET status = 'failed', notes = ?, finished_at = ?, updated_at = ?
      WHERE id = ?
    `).run(error instanceof Error ? error.message : String(error), failedAt, failedAt, runId);
    throw error;
  } finally {
    await browser.close();
  }
}
