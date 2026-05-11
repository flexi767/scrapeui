#!/usr/bin/env tsx
/**
 * Scraper runner for the scrapeui web interface.
 * Emits newline-delimited JSON to stdout for SSE streaming.
 *
 * Usage: tsx scripts/run-for-ui.ts --dealers peevauto,luxcars [--deep]
 */
import { PlaywrightCrawler } from "crawlee";

import { execSync } from "child_process";
import type Database from "better-sqlite3";
import {
  parseMakeModelSync,
  type MakesMap,
} from "@/lib/mobile-bg/makes-models";
import { resolveCarsBgMakeModelIds } from "@/lib/cars-bg/makes-models";
import { normalizeFuelSync } from "@/lib/mobile-bg/fuel-types";
import {
  normalizeTransmissionSync,
} from "@/lib/mobile-bg/transmission-types";
import {
  getBodyTypeMap,
  normalizeBodyTypeSync,
} from "@/lib/mobile-bg/body-types";
import { cleanDescription } from "@/lib/mobile-bg/description";
import { reconcileDeletedMobileBgListings } from "@/lib/mobile-bg/reconcile-deleted";
import { saveListingThumb } from "@/lib/listing-thumbs";
import {
  emit,
  formatError,
  parseRunnerArgs,
  openDb,
  fetchRunnerRefData,
} from "@/scraper/lib/runner";
import fs from "fs";
import path from "path";
import { createCrawlRun, updateCrawlRun } from "@/lib/query-modules/mobilebg";
import { SCRAPED_ROOT } from "@/lib/storage-paths";

const { deepCrawl, downloadImages, requestedSlugs } = parseRunnerArgs();
const HOMEPAGE_CATEGORY_OPTIONS = new Set([
  "Ван",
  "Джип",
  "Кабрио",
  "Комби",
  "Купе",
  "Миниван",
  "Пикап",
  "Седан",
  "Стреч лимузина",
  "Хечбек",
]);

interface ScrapedListingInput {
  url: string;
  title?: string | null;
  adStatus?: string | null;
  kaparo?: boolean | number | null;
  bodyType?: string | null;
  color?: string | null;
  year?: string | null;
  euronorm?: number | null;
  mileage?: number | null;
  fuel?: string | null;
  transmission?: string | null;
  thumb?: string | null;
  price?: { amount?: number | null; currency?: string | null } | null;
  vat?: string | null;
  lastEdit?: string | null;
  views?: number | null;
  isNew?: boolean | number | null;
  imageCount?: number | null;
  images?: {
    meta: unknown;
    thumbKeys: string[];
    fullKeys: string[];
  } | null;
  vin?: string | null;
  extras?: unknown;
  power?: number | null;
  description?: string | null;
  scrapedAt?: string;
  source?: string;
  dealer?: string;
  snapshotDate?: string;
}

interface ExistingListingRow {
  id: number;
  url: string | null;
  title: string | null;
  description: string | null;
  current_price: number | null;
  price_change: number | null;
  vat: string | null;
  last_edit: string | null;
  views: number | null;
  ad_status: string | null;
  kaparo: number | null;
  thumb_saved: number | null;
  reg_month: string | null;
  reg_year: string | null;
  fuel: string | null;
  body_type: string | null;
  transmission: string | null;
  color: string | null;
  vin: string | null;
  euronorm: number | null;
  power: number | null;
  mileage: number | null;
  extras_json: string | null;
  is_new: number | null;
}

interface DealerRow {
  id: number;
  slug: string;
  name: string;
  mobileBg: string;
  own: number; // 1 = own dealer, 0 = competitor
  mobile_user: string | null;
}

function extractMobileId(url: string): string | null {
  const m = url?.match(/obiava-(\d+)/);
  return m ? m[1] : null;
}

function normalizeMobileDetailUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname.endsWith(".mobile.bg") &&
      parsed.hostname !== "www.mobile.bg"
    ) {
      parsed.hostname = "www.mobile.bg";
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function parseReg(yearStr: string | null): {
  regMonth: string | null;
  regYear: string | null;
} {
  if (!yearStr) return { regMonth: null, regYear: null };
  const BG_MONTHS: Record<string, string> = {
    януари: "01",
    февруари: "02",
    март: "03",
    април: "04",
    май: "05",
    юни: "06",
    юли: "07",
    август: "08",
    септември: "09",
    октомври: "10",
    ноември: "11",
    декември: "12",
  };
  const lower = String(yearStr).toLowerCase();
  const yearMatch = lower.match(/(\d{4})/);
  const regYear = yearMatch ? yearMatch[1] : null;
  let regMonth: string | null = null;
  for (const [bg, num] of Object.entries(BG_MONTHS)) {
    if (lower.includes(bg)) {
      regMonth = num;
      break;
    }
  }
  return { regMonth, regYear };
}

function parseViewsCount(text: string | null): number | null {
  if (!text) return null;
  const match =
    text.match(/Прегледана:\s*([\d\s]+)/i) ||
    text.match(/Обявата е видяна\s+([\d\s]+)\s+пъти\.?/i);
  if (!match) return null;
  const normalized = match[1].replace(/\s+/g, "");
  const parsed = parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function upsertListing(
  db: Database.Database,
  dealerId: number,
  listing: ScrapedListingInput,
  makesMap: MakesMap | null,
  fuelMap: Map<string, string> | null,
  transmissionMap: Map<string, string> | null,
) {
  const now = new Date().toISOString();
  const mobileId = extractMobileId(listing.url);
  if (!mobileId)
    return { action: "skip", title: listing.title || "", make: "", model: "" };

  const rawTitle = listing.title || "";
  const { make, model, mobileMakeId, mobileModelId, titleRemainder } =
    parseMakeModelSync(rawTitle, makesMap);
  const normalizedTitle = (titleRemainder || "").trim();
  const { carsMakeId, carsModelId } = await resolveCarsBgMakeModelIds({
    title: rawTitle,
    make,
    model,
  }).catch(() => ({ carsMakeId: null, carsModelId: null }));
  const { regMonth, regYear } = parseReg(listing.year ?? null);
  const fuel = normalizeFuelSync(listing.fuel ?? null, fuelMap);
  const bodyType = normalizeBodyTypeSync(
    listing.bodyType ?? null,
    getBodyTypeMap(),
  );
  const transmission = normalizeTransmissionSync(
    listing.transmission ?? null,
    transmissionMap,
  );
  const vin: string | null = listing.vin ?? null;
  const euronorm: number | null = listing.euronorm ?? null;
  const extrasJson: string | null = listing.extras
    ? JSON.stringify(listing.extras)
    : null;
  const price: number | null = listing.price?.amount ?? null;
  const vat: string | null = listing.vat ?? null;
  const views: number | null = listing.views ?? null;
  const hasOverviewSpecs = Boolean(
    listing.year ||
    listing.mileage != null ||
    listing.fuel ||
    listing.bodyType ||
    listing.transmission ||
    listing.color ||
    listing.vat ||
    listing.euronorm != null,
  );

  const existing = db
    .prepare("SELECT * FROM listings WHERE mobile_id = ?")
    .get(mobileId) as ExistingListingRow | undefined;
  let thumbSaved = existing?.thumb_saved === 1;
  if (!thumbSaved && listing.thumb) {
    try {
      thumbSaved = Boolean(await saveListingThumb(mobileId, listing.thumb));
    } catch {
      thumbSaved = false;
    }
  }
  const isDeep =
    (listing.images?.meta && listing.images.thumbKeys.length > 0) ||
    !!listing.lastEdit ||
    !!listing.description;

  if (existing) {
    const priceChanged = price !== null && price !== existing.current_price;
    const vatChanged = vat != null ? vat !== existing.vat : false;
    const lastEditChanged = isDeep
      ? (listing.lastEdit || null) !== (existing.last_edit || null)
      : false;
    const hadViews = existing.views != null;
    const viewsChanged = isDeep ? hadViews && views !== existing.views : false;
    const adStatusChanged =
      (listing.adStatus || "none") !== (existing.ad_status || "none");
    const kaparoChanged =
      (listing.kaparo ? 1 : 0) !== (existing.kaparo ? 1 : 0);
    const titleChanged = normalizedTitle !== (existing.title || "");
    const hadDescription = Boolean((existing.description || "").trim());
    const descriptionChanged = isDeep
      ? hadDescription &&
        (listing.description || "") !== (existing.description || "")
      : false;
    const trackedChange =
      priceChanged ||
      vatChanged ||
      lastEditChanged ||
      viewsChanged ||
      adStatusChanged ||
      kaparoChanged ||
      titleChanged ||
      descriptionChanged;

    if (trackedChange) {
      db.prepare(
        `
        INSERT INTO listing_snapshots (listing_id, price, vat, last_edit, views, ad_status, kaparo, title, description, recorded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      ).run(
        existing.id,
        priceChanged ? existing.current_price : null,
        vatChanged ? existing.vat : null,
        lastEditChanged ? existing.last_edit || null : null,
        viewsChanged ? (existing.views ?? null) : null,
        adStatusChanged ? existing.ad_status || "none" : null,
        kaparoChanged ? (existing.kaparo ? 1 : 0) : null,
        titleChanged ? existing.title || null : null,
        descriptionChanged ? existing.description || null : null,
        now,
      );
      emit({
        type: "change",
        mobileId,
        make,
        model,
        title: existing.title || normalizedTitle,
        url: listing.url || existing.url,
        dealer: listing.dealer || null,
        thumb: listing.thumb || null,
        price,
        priceChanged,
        oldPrice: priceChanged ? existing.current_price : null,
        newPrice: priceChanged ? price : null,
        vatChanged,
        oldVat: vatChanged ? existing.vat : null,
        newVat: vatChanged ? (isDeep ? vat : existing.vat) : null,
        viewsChanged,
        oldViews: viewsChanged ? (existing.views ?? null) : null,
        newViews: viewsChanged ? views : null,
        adStatusChanged,
        oldStatus: adStatusChanged ? existing.ad_status : null,
        newStatus: adStatusChanged ? listing.adStatus || "none" : null,
        kaparoChanged,
        titleChanged,
        descriptionChanged,
      });
    }

    const imageData =
      listing.images?.meta && listing.images.thumbKeys.length > 0
        ? listing.images
        : null;
    const hasImages = Boolean(imageData);
    const imageFields = hasImages
      ? "image_count = ?, image_meta = ?, thumb_keys = ?, full_keys = ?,"
      : "";
    const imageValues = hasImages
      ? [
          listing.imageCount || 0,
          JSON.stringify(imageData!.meta),
          JSON.stringify(imageData!.thumbKeys),
          JSON.stringify(imageData!.fullKeys || []),
        ]
      : [];
    const priceChangeDelta = priceChanged
      ? price! - (existing.current_price ?? 0)
      : (existing.price_change ?? null);

    db.prepare(
      `
      UPDATE listings SET
        dealer_id = ?, url = ?, title = ?, make = ?, model = ?, mobile_make_id = ?, mobile_model_id = ?, cars_make_id = ?, cars_model_id = ?, reg_month = ?, reg_year = ?,
        fuel = ?, body_type = ?, transmission = ?, color = ?, vin = ?, euronorm = ?, power = ?, mileage = ?, description = ?, extras_json = ?, ad_status = ?, kaparo = ?,
        is_new = ?, last_edit = ?, views = ?, current_price = ?, vat = ?, price_change = ?, ${imageFields}
        last_seen_at = ?, is_active = 1, deleted_at = NULL, thumb_saved = ?
      WHERE id = ?
    `,
    ).run(
      dealerId,
      listing.url,
      normalizedTitle,
      make,
      model,
      mobileMakeId,
      mobileModelId,
      carsMakeId,
      carsModelId,
      (isDeep || hasOverviewSpecs) && regMonth ? regMonth : existing.reg_month,
      (isDeep || hasOverviewSpecs) && regYear ? regYear : existing.reg_year,
      (isDeep || hasOverviewSpecs) && fuel ? fuel : existing.fuel,
      (isDeep || hasOverviewSpecs) && bodyType
        ? bodyType
        : existing.body_type || bodyType || null,
      (isDeep || hasOverviewSpecs) && transmission
        ? transmission
        : existing.transmission,
      (isDeep || hasOverviewSpecs) && listing.color
        ? listing.color
        : existing.color,
      isDeep ? vin : (existing.vin ?? null),
      (isDeep || hasOverviewSpecs) && euronorm != null
        ? euronorm
        : (existing.euronorm ?? null),
      isDeep ? listing.power || null : existing.power,
      (isDeep || hasOverviewSpecs) && listing.mileage != null
        ? listing.mileage
        : existing.mileage,
      isDeep ? listing.description || null : existing.description,
      isDeep ? extrasJson : (existing.extras_json ?? null),
      listing.adStatus || existing.ad_status || "none",
      listing.kaparo ? 1 : 0,
      isDeep ? (listing.isNew ? 1 : 0) : existing.is_new,
      isDeep ? listing.lastEdit || null : existing.last_edit,
      isDeep ? views : (existing.views ?? null),
      price,
      vat != null ? vat : (existing.vat ?? null),
      priceChangeDelta,
      ...imageValues,
      now,
      thumbSaved ? 1 : (existing.thumb_saved ?? 0),
      existing.id,
    );
    return {
      action: "updated",
      snapshot: trackedChange,
      title: normalizedTitle,
      make,
      model,
    };
  }

  db.prepare(
    `
    INSERT INTO listings (
      mobile_id, dealer_id, url, title, make, model, mobile_make_id, mobile_model_id, cars_make_id, cars_model_id, reg_month, reg_year,
      fuel, body_type, transmission, color, vin, euronorm, power, mileage, description, extras_json, ad_status, kaparo, is_new,
      last_edit, views, current_price, vat, image_count, image_meta, thumb_keys, full_keys,
      images_downloaded, thumb_saved, first_seen_at, last_seen_at, is_active, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 1, NULL)
  `,
  ).run(
    mobileId,
    dealerId,
    listing.url,
    normalizedTitle,
    make,
    model,
    mobileMakeId,
    mobileModelId,
    carsMakeId,
    carsModelId,
    regMonth,
    regYear,
    fuel || null,
    bodyType || null,
    transmission || null,
    listing.color || null,
    vin,
    euronorm,
    listing.power || null,
    listing.mileage || null,
    listing.description || null,
    extrasJson,
    listing.adStatus || "none",
    listing.kaparo ? 1 : 0,
    listing.isNew ? 1 : 0,
    listing.lastEdit || null,
    views,
    price,
    vat,
    listing.imageCount || 0,
    listing.images?.meta ? JSON.stringify(listing.images.meta) : null,
    listing.images?.thumbKeys ? JSON.stringify(listing.images.thumbKeys) : null,
    listing.images?.fullKeys ? JSON.stringify(listing.images.fullKeys) : null,
    thumbSaved ? 1 : 0,
    now,
    now,
  );
  return {
    action: "inserted",
    snapshot: false,
    title: normalizedTitle,
    make,
    model,
  };
}

function seedDraft(
  db: Database.Database,
  dealer: DealerRow,
  listing: ScrapedListingInput,
  listingDbId: number,
  make: string | null,
  model: string | null,
): number | null {
  const mobileId = extractMobileId(listing.url ?? "");
  if (!mobileId) return null;
  const now = new Date().toISOString();
  const { regYear } = parseReg(listing.year ?? null);
  const result = db
    .prepare(
      `
    INSERT OR IGNORE INTO mobilebg_backups
      (dealer_id, listing_id, mobile_id, source_url, title, make, model,
       price_amount, price_currency, description, year, mileage, fuel,
       transmission, color, category, extras_json, image_count,
       created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      dealer.id,
      listingDbId,
      mobileId,
      listing.url,
      listing.title ?? null,
      make,
      model,
      listing.price?.amount ?? null,
      listing.price?.currency ?? "EUR",
      listing.description ?? null,
      regYear ? parseInt(regYear, 10) : null,
      listing.mileage ?? null,
      listing.fuel ?? null,
      listing.transmission ?? null,
      listing.color ?? null,
      listing.bodyType ?? null,
      listing.extras ? JSON.stringify(listing.extras) : null,
      listing.imageCount ?? 0,
      now,
      now,
    );
  if (result.changes === 0) {
    const row = db
      .prepare(
        `SELECT id FROM mobilebg_backups WHERE dealer_id = ? AND mobile_id = ? LIMIT 1`,
      )
      .get(dealer.id, mobileId) as { id: number } | undefined;
    return row?.id ?? null;
  }
  return result.lastInsertRowid as number;
}

async function downloadListingImages(
  db: Database.Database,
  dealer: DealerRow,
  mobileId: string,
  backupId: number,
  fullUrls: string[],
): Promise<{ downloaded: number; failed: number }> {
  const dir = path.join(
    SCRAPED_ROOT,
    "mobilebg-backups",
    dealer.slug,
    mobileId,
  );
  fs.mkdirSync(dir, { recursive: true });

  let downloaded = 0;
  let failed = 0;

  for (let i = 0; i < fullUrls.length; i++) {
    const srcUrl = fullUrls[i];
    const keyMatch = srcUrl.match(/[^/_]+_([^.]+)\.webp$/);
    const key = keyMatch?.[1] ?? `img_${i}`;
    const filename = `${key}.webp`;
    const localPath = path.join(dir, filename);

    if (fs.existsSync(localPath)) {
      downloaded++;
      continue;
    }

    try {
      const res = await fetch(srcUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(localPath, buf);

      const now = new Date().toISOString();
      db.prepare(
        `
      INSERT OR IGNORE INTO mobilebg_backup_images
        (backup_id, sort_order, filename, source_url, local_path, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      ).run(backupId, i, filename, srcUrl, localPath, now);

      downloaded++;
    } catch {
      failed++;
    }
  }

  return { downloaded, failed };
}

async function scrapeCompetitorForUI(
  dealer: DealerRow,
  db: Database.Database,
  makesMap: MakesMap | null,
  fuelMap: Map<string, string> | null,
  transmissionMap: Map<string, string> | null,
): Promise<{ count: number; imagesDownloaded: number; imagesFailed: number }> {
  let count = 0;
  let totalImagesDownloaded = 0;
  let totalImagesFailed = 0;
  const maxPages = 20;
  const snapshotDate = new Date().toISOString().slice(0, 10);
  const seenMobileIds = new Set<string>();

  const crawler = new PlaywrightCrawler({
    maxRequestRetries: 3,
    requestHandlerTimeoutSecs: 60,
    headless: true,
    maxConcurrency: 3,

    async requestHandler({ page, request }) {
      const url = request.url;

      if (request.label === "LIST" || !request.label) {
        await page
          .waitForSelector("a.title", { timeout: 15000 })
          .catch(() => {});

        const cards = await page.evaluate(() =>
          Array.from(document.querySelectorAll("a.title"))
            .map((a) => {
              const card = a.closest(".zaglavie") || a.parentElement;
              const item =
                a.closest('[class*="item"]') ||
                card?.closest('[class*="item"]');
              const itemClass = item?.className || "";
              const priceEl = card?.querySelector(".price");
              const priceWrapText = (
                priceEl?.parentElement?.textContent ||
                item?.textContent ||
                ""
              ).trim();
              const itemText = (item?.textContent || "").trim();
              const params = Array.from(
                item?.querySelectorAll(".params span") || [],
              )
                .map((span) => span.textContent?.trim() || "")
                .filter(Boolean);
              const transmissionOptions = [
                "Ръчна",
                "Автоматична",
                "Полуавтоматична",
              ];
              const transmissionIndex = params.findIndex((value) =>
                transmissionOptions.includes(value),
              );
              const year = params.find((value) => /\d{4}/.test(value)) || null;
              const euronormText =
                params.find((value) => /(?:евро|euro)\s*\d/i.test(value)) ||
                null;
              const mileageIndex = params.findIndex((value) =>
                /км/i.test(value),
              );
              const mileage = mileageIndex !== -1 ? params[mileageIndex] : null;
              const color =
                mileageIndex !== -1 ? params[mileageIndex + 1] || null : null;
              const fuel =
                params.find((value) =>
                  /(бенз|дизел|electric|електр|хибрид|газ|метан)/i.test(value),
                ) || null;
              const transmission =
                transmissionIndex !== -1 ? params[transmissionIndex] : null;
              const bodyType =
                params.find((value) =>
                  [
                    "Ван",
                    "Джип",
                    "Кабрио",
                    "Комби",
                    "Купе",
                    "Миниван",
                    "Пикап",
                    "Седан",
                    "Стреч лимузина",
                    "Хечбек",
                  ].includes(value),
                ) ||
                (transmissionIndex !== -1
                  ? params[transmissionIndex + 1] || null
                  : null);
              const vatText = /без ддс/i.test(priceWrapText)
                ? "без ДДС"
                : /с включено ддс|с ддс|вкл\.?\s*ддс/i.test(priceWrapText)
                  ? "с ДДС"
                  : /не се начислява ддс|частно лице|освободена/i.test(
                        priceWrapText,
                      )
                    ? "не се начислява ДДС"
                    : null;
              const adStatus = /\bTOP\b/i.test(itemClass)
                ? "TOP"
                : /\bVIP\b/i.test(itemClass)
                  ? "VIP"
                  : "none";
              const kaparo = !!(
                a.closest(".kaparo") ||
                item?.querySelector(".kaparo") ||
                item?.classList?.contains("kaparo")
              );
              const imageCountMatch = itemText.match(
                /Повече детайли\s*и\s*(\d+)\s*снимк/i,
              );
              const imageCount = imageCountMatch
                ? parseInt(imageCountMatch[1], 10) || 0
                : itemText.includes("Повече детайли")
                  ? 1
                  : 0;
              const allImgs = Array.from(item?.querySelectorAll("img") || []);
              const thumbImg = allImgs.find((i) => {
                const src =
                  (i as HTMLImageElement).currentSrc ||
                  (i as HTMLImageElement).src ||
                  i.getAttribute("data-src") ||
                  i.getAttribute("data-lazy") ||
                  i.getAttribute("data-srcset") ||
                  i.getAttribute("srcset") ||
                  "";
                return (
                  src && !src.endsWith(".svg") && src.includes("photosorg")
                );
              }) as HTMLImageElement | undefined;
              const thumb =
                thumbImg?.currentSrc ||
                thumbImg?.src ||
                thumbImg?.getAttribute("data-src") ||
                thumbImg?.getAttribute("data-lazy") ||
                thumbImg
                  ?.getAttribute("data-srcset")
                  ?.split(",")[0]
                  ?.trim()
                  .split(" ")[0] ||
                thumbImg
                  ?.getAttribute("srcset")
                  ?.split(",")[0]
                  ?.trim()
                  .split(" ")[0] ||
                "";
              return {
                url: (a as HTMLAnchorElement).href,
                title: a.textContent?.trim() || "",
                priceText: priceEl?.textContent?.trim() || "",
                vatText,
                year,
                euronormText,
                mileage,
                color,
                fuel,
                transmission,
                adStatus,
                kaparo,
                imageCount,
                bodyType,
                thumb,
              };
            })
            .filter((c) => c.url.includes("/obiava-")),
        );

        for (const card of cards) {
          const mobileId = extractMobileId(card.url);
          if (mobileId) seenMobileIds.add(mobileId);
        }

        if (deepCrawl) {
          for (const card of cards) {
            await crawler.addRequests([
              {
                url: normalizeMobileDetailUrl(card.url),
                label: "DETAIL",
                userData: {
                  ...card,
                  originalUrl: card.url,
                },
              },
            ]);
          }
        } else {
          for (const card of cards) {
            const priceMatch = card.priceText
              .replace(/\s/g, "")
              .match(/([\d.,]+)€/);
            const priceAmount = priceMatch
              ? Math.round(parseFloat(priceMatch[1].replace(",", "")))
              : null;
            const bodyType =
              card.bodyType && HOMEPAGE_CATEGORY_OPTIONS.has(card.bodyType)
                ? card.bodyType
                : null;
            const vatLower = (card.vatText || "").toLowerCase();
            let vat: string | null = null;
            if (
              vatLower.includes("не се начислява") ||
              vatLower.includes("частно лице") ||
              vatLower.includes("освободена")
            )
              vat = "exempt";
            else if (vatLower.includes("с ддс") || vatLower.includes("вкл"))
              vat = "included";
            else if (vatLower.includes("без ддс")) vat = "excluded";
            const listing = {
              url: card.url,
              title: card.title,
              adStatus: card.adStatus,
              kaparo: card.kaparo,
              bodyType,
              color: card.color || null,
              year: card.year || null,
              euronorm: card.euronormText
                ? parseInt(card.euronormText.match(/(\d+)/)?.[1] || "", 10) ||
                  null
                : null,
              mileage: card.mileage
                ? parseInt(String(card.mileage).replace(/\D/g, ""), 10) || null
                : null,
              fuel: card.fuel || null,
              transmission: card.transmission || null,
              thumb: card.thumb || "",
              price: { amount: priceAmount, currency: "EUR" },
              vat,
              lastEdit: null,
              isNew: false,
              imageCount: card.imageCount || 0,
              images: { meta: null, thumbKeys: [], fullKeys: [] },
              scrapedAt: new Date().toISOString(),
              source: "mobile.bg",
              dealer: dealer.slug,
              snapshotDate,
            };
            const result = await upsertListing(
              db,
              dealer.id,
              listing,
              makesMap,
              fuelMap,
              transmissionMap,
            );
            count++;
            emit({
              type: "listing",
              dealer: dealer.slug,
              make: result.make,
              model: result.model,
              title: result.title,
              price: priceAmount,
              url: card.url,
              thumb: card.thumb || "",
              newListing: result.action === "inserted",
              imageCount: card.imageCount || 0,
              views: null,
            });
          }
        }

        const currentPage = parseInt(
          new URL(url).searchParams.get("page") || "1",
          10,
        );
        if (currentPage < maxPages) {
          const hasNext = await page.evaluate(
            (cp: number) =>
              Array.from(document.querySelectorAll("a")).some(
                (a) =>
                  a.href.includes(`page=${cp + 1}`) ||
                  a.textContent?.trim() === String(cp + 1),
              ),
            currentPage,
          );
          if (hasNext) {
            const nextUrl = new URL(dealer.mobileBg);
            nextUrl.searchParams.set("page", String(currentPage + 1));
            await crawler.addRequests([
              { url: nextUrl.toString(), label: "LIST" },
            ]);
          }
        }
      }

      if (request.label === "DETAIL") {
        try {
          await page
            .waitForSelector(".Price, .disp", { timeout: 15000 })
            .catch(() => {});

          const raw = await page.evaluate(() => {
            const priceEl = document.querySelector(".Price");
            const priceText = (priceEl?.innerHTML || "")
              .split("<br>")[0]
              .replace(/<[^>]+>/g, "")
              .trim();
            const vatText =
              document.querySelector(".PriceInfo")?.textContent?.trim() || "";
            const statistikiText =
              (
                document.querySelector(".statistiki") as HTMLElement
              )?.innerText?.trim() || "";
            const description =
              (
                document.querySelector(".moreInfo") as HTMLElement
              )?.innerText?.trim() || "";
            const thumbUrls = Array.from(
              document.querySelectorAll(".smallPicturesGallery img"),
            )
              .map((img) => (img as HTMLImageElement).src)
              .filter(Boolean);
            const fullUrls = Array.from(
              new Set(
                Array.from(
                  document.querySelectorAll(
                    ".carouselimg, [class*=carousel] img",
                  ),
                )
                  .map(
                    (img) =>
                      (img as HTMLImageElement).src ||
                      img.getAttribute("data-src") ||
                      "",
                  )
                  .filter(
                    (src) => src.includes("/big1/") && src.includes(".webp"),
                  ),
              ),
            );
            const extras = Array.from(
              document.querySelectorAll(".carExtri .items div"),
            )
              .map((el) => el.textContent?.trim() || "")
              .filter(Boolean);
            const parsedThumbs = thumbUrls.map((src) => {
              const match = src.match(
                /^https?:\/\/([^/]+)\/mobile\/photosorg\/\d+\/(\d+)\/(?:big1\/)?[^_]+_([^.]+)\.webp$/,
              );
              return match
                ? { cdn: match[1], shard: match[2], key: match[3] }
                : null;
            });
            const parsedFull = fullUrls.map((src) => {
              const match = src.match(
                /^https?:\/\/([^/]+)\/mobile\/photosorg\/\d+\/(\d+)\/(?:big1\/)?[^_]+_([^.]+)\.webp$/,
              );
              return match
                ? { cdn: match[1], shard: match[2], key: match[3] }
                : null;
            });
            const firstThumb = parsedThumbs.find(Boolean) || null;
            const imgMeta = firstThumb
              ? { cdn: firstThumb.cdn, shard: firstThumb.shard }
              : null;
            const thumbKeys = parsedThumbs
              .map((item) => item?.key)
              .filter(Boolean) as string[];
            const fullKeys = parsedFull
              .map((item) => item?.key)
              .filter(Boolean) as string[];
            return {
              priceText,
              vatText,
              bodyText: document.body.innerText.substring(0, 5000),
              statistikiText,
              description,
              imgMeta,
              thumbKeys,
              fullKeys,
              fullUrls,
              firstThumbUrl: thumbUrls[0] || "",
              extras,
            };
          });

          const euroMatch = raw.priceText
            .replace(/\s/g, "")
            .match(/([\d.,]+)€/);
          const priceAmount = euroMatch
            ? Math.round(parseFloat(euroMatch[1].replace(",", "")))
            : null;

          const vatLower = raw.vatText.toLowerCase();
          let vat: string | null = null;
          if (
            vatLower.includes("освободена") ||
            vatLower.includes("частна") ||
            vatLower.includes("не се начислява")
          )
            vat = "exempt";
          else if (
            vatLower.includes("с включено ддс") ||
            vatLower.includes("с ддс") ||
            vatLower.includes("вкл")
          )
            vat = "included";
          else if (vatLower.includes("без ддс")) vat = "excluded";

          const extract = (label: string) => {
            const m = raw.bodyText.match(new RegExp(label + "\\s*\\n\\s*(.+)"));
            return m ? m[1].trim() : null;
          };

          // Extract with additional validation to prevent capturing multiple fields
          const extractSingleWord = (label: string) => {
            const raw_value = extract(label);
            if (!raw_value) return null;
            // For single-word fields like body type, only keep the first word and reject if it contains digits or brackets
            const firstWord = raw_value.split(/[\s\[\](\n]/)[0];
            if (!firstWord || /\d/.test(firstWord)) return null;
            return firstWord;
          };

          const mileageRaw = extract("Пробег \\[км\\]");
          const powerRaw = extract("Мощност");
          const vinRaw = extract("VIN номер");
          const euronormRaw = extract("Евростандарт");
          let lastEdit: string | null = null;
          let views: number | null = null;
          let isNew = false;
          if (raw.statistikiText) {
            isNew = !raw.statistikiText.startsWith("Редактирана");
            const dateMatch = raw.statistikiText.match(
              /(\d{2})\.(\d{2})\.(\d{4})/,
            );
            const timeMatch = raw.statistikiText.match(/(\d{2}:\d{2})/);
            if (dateMatch) {
              const [, dd, mm, yyyy] = dateMatch;
              lastEdit = `${yyyy}-${mm}-${dd} ${timeMatch ? timeMatch[1] : "00:00"}`;
            }
            views = parseViewsCount(raw.statistikiText);
          }

          const listing = {
            url: request.userData?.originalUrl || url,
            title: request.userData?.title || "",
            adStatus: request.userData?.adStatus || "none",
            kaparo: request.userData?.kaparo || false,
            thumb: raw.firstThumbUrl || request.userData?.thumb || "",
            price: { amount: priceAmount, currency: "EUR" },
            vat,
            lastEdit,
            views,
            isNew,
            year: extract("Дата на производство"),
            mileage: mileageRaw
              ? parseInt(mileageRaw.replace(/\D/g, ""), 10) || null
              : null,
            color: extract("Цвят"),
            fuel: extract("Двигател"),
            vin: vinRaw ? vinRaw.split(/\s+/)[0] : null,
            euronorm: euronormRaw
              ? parseInt(euronormRaw.match(/(\d+)/)?.[1] || "", 10) || null
              : null,
            extras: raw.extras,
            bodyType: extractSingleWord("Категория"),
            transmission: extract("Скоростна кутия"),
            power: powerRaw
              ? parseInt(powerRaw.match(/(\d+)/)?.[1] || "", 10) || null
              : null,
            description: cleanDescription(raw.description),
            imageCount: raw.thumbKeys.length,
            images: {
              meta: raw.imgMeta,
              thumbKeys: raw.thumbKeys,
              fullKeys: raw.fullKeys,
            },
            scrapedAt: new Date().toISOString(),
            source: "mobile.bg",
            dealer: dealer.slug,
            snapshotDate,
          };
          const result = await upsertListing(
            db,
            dealer.id,
            listing,
            makesMap,
            fuelMap,
            transmissionMap,
          );
          count++;

          let detailImagesDownloaded = 0;
          let detailImagesFailed = 0;

          if (dealer.own === 1) {
            const mobileId = extractMobileId(listing.url ?? "");
            const listingRow = mobileId
              ? (db
                  .prepare(
                    `SELECT id FROM listings WHERE dealer_id = ? AND mobile_id = ? LIMIT 1`,
                  )
                  .get(dealer.id, mobileId) as { id: number } | undefined)
              : undefined;
            const listingDbId = listingRow?.id ?? null;

            if (listingDbId) {
              const backupId = seedDraft(
                db,
                dealer,
                listing,
                listingDbId,
                result.make ?? null,
                result.model ?? null,
              );
              if (backupId && downloadImages && raw.fullUrls.length > 0) {
                const counts = await downloadListingImages(
                  db,
                  dealer,
                  mobileId!,
                  backupId,
                  raw.fullUrls,
                );
                detailImagesDownloaded = counts.downloaded;
                detailImagesFailed = counts.failed;
              }
            }
          }

          totalImagesDownloaded += detailImagesDownloaded;
          totalImagesFailed += detailImagesFailed;

          emit({
            type: "listing",
            dealer: dealer.slug,
            make: result.make,
            model: result.model,
            title: result.title,
            price: priceAmount,
            url,
            thumb: raw.firstThumbUrl || request.userData?.thumb || "",
            newListing: result.action === "inserted",
            imageCount: raw.thumbKeys.length,
            views,
          });
        } catch (err) {
          throw err;
        }
      }
    },
  });

  await crawler.run([{ url: dealer.mobileBg, label: "LIST" }]);
  if (seenMobileIds.size === 0) {
    emit({
      type: "log",
      message: `Skipping reconciliation for ${dealer.slug}: crawl returned 0 listings (likely a failed fetch)`,
    });
  } else {
    const reconciliation = reconcileDeletedMobileBgListings(
      db,
      dealer.id as number,
      seenMobileIds,
    );
    emit({
      type: "log",
      message: `Reconciled live mobile.bg listings for ${dealer.slug}: reactivated ${reconciliation.reactivatedCount}, marked ${reconciliation.deletedCount} deleted`,
    });
  }
  return {
    count,
    imagesDownloaded: totalImagesDownloaded,
    imagesFailed: totalImagesFailed,
  };
}

function killOtherInstances() {
  const myPid = process.pid;
  try {
    const out = execSync(`pgrep -f 'run-for-ui\\.ts' || true`, {
      encoding: "utf-8",
    }).trim();
    if (!out) return;
    const pids = out
      .split("\n")
      .map((s) => parseInt(s, 10))
      .filter((pid) => pid && pid !== myPid);
    for (const pid of pids) {
      try {
        process.kill(pid, "SIGTERM");
        emit({
          type: "log",
          message: `Killed previous scrapeui instance (pid ${pid})`,
        });
      } catch {
        // already dead
      }
    }
  } catch {
    // pgrep not available or failed — continue anyway
  }
}

async function main() {
  killOtherInstances();
  const db = openDb();
  const { makesMap, fuelMap, transmissionMap } = await fetchRunnerRefData();

  const dealers = db
    .prepare(
      `
    SELECT id, slug, name, mobile_url as mobileBg, own, active,
           mobile_user, mobile_password, cars_url, cars_user, cars_password
    FROM dealers WHERE active = 1 AND mobile_url IS NOT NULL ORDER BY name
  `,
    )
    .all() as DealerRow[];

  const selected =
    requestedSlugs.length > 0
      ? dealers.filter((d) => requestedSlugs.includes(d.slug))
      : dealers;

  if (selected.length === 0) {
    emit({ type: "error", message: "No matching dealers found" });
    process.exit(1);
  }

  let hadErrors = false;
  for (const dealer of selected) {
    emit({ type: "log", message: `Starting scrape: ${dealer.name}` });
    const runId = createCrawlRun(dealer.id, dealer.mobileBg ?? "");
    try {
      const { count, imagesDownloaded, imagesFailed } =
        await scrapeCompetitorForUI(
          dealer,
          db,
          makesMap,
          fuelMap,
          transmissionMap,
        );
      updateCrawlRun(runId, {
        status: "completed",
        listingsCount: count,
        imagesDownloaded,
        imagesFailed,
      });
      emit({ type: "done", dealer: dealer.slug, count });
    } catch (err) {
      hadErrors = true;
      updateCrawlRun(runId, {
        status: "failed",
        listingsCount: 0,
        imagesDownloaded: 0,
        imagesFailed: 0,
      });
      emit({
        type: "error",
        message: `Error scraping ${dealer.name}: ${formatError(err)}`,
      });
    }
  }

  if (!hadErrors) emit({ type: "seeded", message: "Data saved" });
  db.close();
}

main().catch((err) => {
  emit({ type: "error", message: formatError(err) });
  process.exit(1);
});
