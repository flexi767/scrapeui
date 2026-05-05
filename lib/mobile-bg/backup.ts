import fsp from "fs/promises";
import path from "path";
import type Database from "better-sqlite3";
import { chromium } from "playwright";
import { loginMobileBg } from "@/lib/mobile-bg/auth";
import { USER_AGENT } from "@/lib/mobile-bg/constants";
import { fetchMakesModels } from "@/lib/mobile-bg/makes-models";
import { loadMobileBgMakesMapFromDb } from "@/lib/mobile-bg/reference";
import { captureEditFormSnapshotWithPage } from "@/lib/mobile-bg/edit-form-capture";
import { reconcileDeletedMobileBgListings } from "@/lib/mobile-bg/reconcile-deleted";
import { normalizeImageUrl } from "@/lib/mobile-bg/backup-images";
import { parseJson } from "@/lib/utils";
import type {
  BackupDealerResult,
  BackupDefaultsRow,
  BackupProgressEvent,
  DealerBackupConfig,
  DealerDraftDefaults,
  DealerDraftRow,
  ScrapedDetail,
  SnapshotFieldsRow,
} from "@/lib/mobile-bg/backup-types";
import {
  collectListingLinks,
  scrapeListingDetail,
  downloadAllImages,
} from "@/lib/mobile-bg/backup-scraper";
import {
  createBackupRun,
  dedupeMobileBgBackups,
  upsertBackupArtifact,
  insertBackupImages,
} from "@/lib/mobile-bg/backup-db";

export type { BackupDealerResult, BackupProgressEvent, DealerBackupConfig };
export { dedupeMobileBgBackups };

export interface SavePublicListingDraftResult {
  backupId: number;
  mobileId: string;
  title: string;
}

const CRAWL_CACHE_TTL_HOURS = 24; // Cache dealer homepage crawls for 24 hours

export function getStorageRoot(dbPath: string): string {
  return path.join(path.dirname(dbPath), "mobilebg-backups");
}

async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

interface CrawlQueueEntry {
  id: number;
  dealer_id: number;
  url: string;
  url_type: string;
  status: string;
  mobile_id: string | null;
  listings_count: number | null;
  price: number | null;
  views: number | null;
  error: string | null;
  last_crawled_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CrawlCacheResult {
  cached: boolean;
  listingsCount: number | null;
}

function getCrawlQueueEntry(
  db: Database.Database,
  dealerId: number,
  url: string,
  urlType: string,
): CrawlQueueEntry | undefined {
  return db
    .prepare(
      `
    SELECT *
    FROM mobilebg_crawl_queue
    WHERE dealer_id = ? AND url = ? AND url_type = ?
    ORDER BY last_crawled_at DESC, id DESC
    LIMIT 1
  `,
    )
    .get(dealerId, url, urlType) as CrawlQueueEntry | undefined;
}

function checkCrawlCache(
  db: Database.Database,
  dealerId: number,
  url: string,
  urlType: string,
): CrawlCacheResult {
  const entry = getCrawlQueueEntry(db, dealerId, url, urlType);
  if (!entry || !entry.last_crawled_at) {
    return { cached: false, listingsCount: null };
  }

  const lastCrawledAt = new Date(entry.last_crawled_at);
  const now = new Date();
  const hoursSinceLastCrawl =
    (now.getTime() - lastCrawledAt.getTime()) / (1000 * 60 * 60);

  if (hoursSinceLastCrawl > CRAWL_CACHE_TTL_HOURS) {
    return { cached: false, listingsCount: null };
  }

  return {
    cached: true,
    listingsCount: entry.listings_count,
  };
}

function saveCrawlQueueStatus(
  db: Database.Database,
  dealerId: number,
  url: string,
  urlType: string,
  data: {
    mobileId?: string;
    listingsCount?: number;
    price?: number;
    views?: number;
    status?: string;
    error?: string;
  },
): void {
  const now = new Date().toISOString();
  const existing = getCrawlQueueEntry(db, dealerId, url, urlType);

  if (existing) {
    const updates: string[] = ["updated_at = ?", "last_crawled_at = ?"];
    const values: (string | number | null)[] = [now, now];

    if (data.mobileId !== undefined) {
      updates.push("mobile_id = ?");
      values.push(data.mobileId);
    }
    if (data.listingsCount !== undefined) {
      updates.push("listings_count = ?");
      values.push(data.listingsCount);
    }
    if (data.price !== undefined) {
      updates.push("price = ?");
      values.push(data.price);
    }
    if (data.views !== undefined) {
      updates.push("views = ?");
      values.push(data.views);
    }
    if (data.status !== undefined) {
      updates.push("status = ?");
      values.push(data.status);
    }
    if (data.error !== undefined) {
      updates.push("error = ?");
      values.push(data.error);
    }

    values.push(existing.id);
    db.prepare(
      `UPDATE mobilebg_crawl_queue SET ${updates.join(", ")} WHERE id = ?`,
    ).run(...values);
  } else {
    db.prepare(
      `
      INSERT INTO mobilebg_crawl_queue (
        dealer_id, url, url_type, status, mobile_id, listings_count, price, views, error,
        last_crawled_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    ).run(
      dealerId,
      url,
      urlType,
      data.status ?? "completed",
      data.mobileId ?? null,
      data.listingsCount ?? null,
      data.price ?? null,
      data.views ?? null,
      data.error ?? null,
      now,
      now,
      now,
    );
  }
}

function getSnapshotFieldValue(
  fields: Array<{ name?: string; value?: string }>,
  name: string,
): string {
  return fields.find((field) => field.name === name && field.value)?.value ?? "";
}

function getDealerDraftDefaults(
  db: Database.Database,
  dealerId: number,
): DealerDraftDefaults {
  const snapshot = db
    .prepare(
      `
      SELECT fields_json
      FROM mobilebg_edit_form_snapshots
      WHERE dealer_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    )
    .get(dealerId) as SnapshotFieldsRow | undefined;
  const fields = parseJson<Array<{ name?: string; value?: string }>>(
    snapshot?.fields_json,
    [],
  );

  const backup = db
    .prepare(
      `
      SELECT tech_data_json, phones_json
      FROM mobilebg_backups
      WHERE dealer_id = ?
      ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
      LIMIT 1
    `,
    )
    .get(dealerId) as BackupDefaultsRow | undefined;
  const techData = parseJson<Record<string, string>>(backup?.tech_data_json, {});
  const phones = parseJson<string[]>(backup?.phones_json, []);

  return {
    region: getSnapshotFieldValue(fields, "f18") || techData.region || "",
    city: getSnapshotFieldValue(fields, "f19") || techData.city || "",
    phone: getSnapshotFieldValue(fields, "f22") || techData.f22 || phones[0] || "",
    email: getSnapshotFieldValue(fields, "f23") || techData.f23 || "",
    website: getSnapshotFieldValue(fields, "f24") || techData.f24 || "",
  };
}

function buildDraftTechData(
  detail: ScrapedDetail,
  defaults: DealerDraftDefaults,
): Record<string, string> {
  const techData: Record<string, string> = {};
  const productionDate = detail.techData["Дата на производство"] ?? "";
  const productionMatch = productionDate.match(/^(\S+)\s+(\d{4})/u);
  const euronorm = detail.techData["Евростандарт"]?.match(/\d+/)?.[0] ?? "";
  const batteryRange =
    detail.techData["Пробег с едно зареждане (WLTP) [км]"] ||
    detail.techData["Пробег с едно зареждане (WLTP)"] ||
    detail.techData["Пробег с едно зареждане"] ||
    "";
  const batteryCapacity =
    detail.techData["Капацитет на батерията [kWh]"] ||
    detail.techData["Капацитет на батерията"] ||
    "";

  techData.pubtype = "1,2";
  techData.f13 = detail.priceCurrency || "EUR";
  techData.f25 = "0";
  if (productionMatch) {
    techData.f14 = productionMatch[1];
    techData.f15 = productionMatch[2];
  } else if (detail.year) {
    techData.f15 = String(detail.year);
  }
  if (euronorm) techData.f29 = euronorm;
  if (batteryRange) techData.f33 = batteryRange.match(/\d{2,4}/)?.[0] ?? batteryRange;
  if (batteryCapacity) techData.f34 = batteryCapacity.match(/\d{1,4}/)?.[0] ?? batteryCapacity;
  if (defaults.region) techData.region = defaults.region;
  if (defaults.city) techData.city = defaults.city;
  if (defaults.phone) techData.f22 = defaults.phone;
  if (defaults.email) techData.f23 = defaults.email;
  if (defaults.website) techData.f24 = defaults.website;

  return techData;
}

export async function savePublicMobileBgListingAsDraft(
  db: Database.Database,
  dealerSlug: string,
  listingUrl: string,
): Promise<SavePublicListingDraftResult> {
  const normalizedUrl = normalizeImageUrl(listingUrl);
  if (!normalizedUrl || !/mobile\.bg\/.*obiava-\d+/i.test(normalizedUrl)) {
    throw new Error("A valid mobile.bg listing URL is required");
  }

  const dealer = db
    .prepare(
      `
      SELECT id, slug, name, own, active
      FROM dealers
      WHERE slug = ?
      LIMIT 1
    `,
    )
    .get(dealerSlug) as DealerDraftRow | undefined;

  if (!dealer || dealer.own !== 1 || dealer.active !== 1) {
    throw new Error(`Own active dealer not found: ${dealerSlug}`);
  }

  const now = new Date().toISOString();
  const runId = createBackupRun(db, dealer.id, normalizedUrl);

  const makesMap =
    loadMobileBgMakesMapFromDb(db) ?? (await fetchMakesModels().catch(() => null));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  try {
    const detail = await scrapeListingDetail(page, normalizedUrl, makesMap, {
      includeImages: false,
    });
    const defaults = getDealerDraftDefaults(db, dealer.id);
    const techData = buildDraftTechData(detail, defaults);
    const normalizedColor = detail.color
      ? detail.color.split(/\r?\n/)[0].trim() || null
      : null;

    const result = db
      .prepare(
        `
        INSERT INTO mobilebg_backups (
          run_id, dealer_id, listing_id, mobile_id, source_url, source_title, make, model, title,
          price_amount, price_currency, vat_included, year, mileage, fuel, power, engine, color,
          transmission, category, description, ad_status, kaparo, draft_needs_sync,
          phones_json, extras_json, tech_data_json, photo_order_json, image_count, created_at, updated_at
        ) VALUES (?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'none', 0, 0, ?, ?, ?, ?, 0, ?, ?)
      `,
      )
      .run(
        runId,
        dealer.id,
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
        normalizedColor,
        detail.transmission,
        detail.category,
        detail.description,
        JSON.stringify(defaults.phone ? [defaults.phone] : []),
        JSON.stringify(detail.extras),
        JSON.stringify(techData),
        JSON.stringify(detail.photoOrder),
        now,
        now,
      );

    const backupId = Number(result.lastInsertRowid);
    saveCrawlQueueStatus(db, dealer.id, normalizedUrl, "listing_detail", {
      mobileId: detail.mobileId,
      price: detail.priceAmount ? Math.floor(detail.priceAmount) : undefined,
      status: "completed",
    });

    const finishedAt = new Date().toISOString();
    db.prepare(
      `
      UPDATE mobilebg_backup_runs
      SET status = 'completed', listings_count = 1, images_count = 0, finished_at = ?, updated_at = ?
      WHERE id = ?
    `,
    ).run(finishedAt, finishedAt, runId);

    return {
      backupId,
      mobileId: detail.mobileId,
      title: detail.title || detail.sourceTitle,
    };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : String(error);
    db.prepare(
      `
      UPDATE mobilebg_backup_runs
      SET status = 'failed', notes = ?, finished_at = ?, updated_at = ?
      WHERE id = ?
    `,
    ).run(message, failedAt, failedAt, runId);
    saveCrawlQueueStatus(db, dealer.id, normalizedUrl, "listing_detail", {
      status: "failed",
      error: message,
    });
    throw error;
  } finally {
    await browser.close();
  }
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
  onProgress?.({
    type: "status",
    dealer: dealer.name,
    message: "Starting backup run",
    runId,
  });
  const makesMap = await fetchMakesModels().catch(() => null);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  try {
    onProgress?.({
      type: "status",
      dealer: dealer.name,
      message: "Logging into mobile.bg",
      runId,
    });
    const loggedIn = await loginMobileBg(
      page,
      dealer.mobileUser,
      dealer.mobilePassword,
    );
    if (!loggedIn) {
      throw new Error(`Login failed for ${dealer.slug}`);
    }

    onProgress?.({
      type: "status",
      dealer: dealer.name,
      message: "Collecting dealer listings",
      runId,
    });

    // Check if dealer homepage crawl is cached
    const homepageCache = checkCrawlCache(
      db,
      dealer.id,
      dealer.mobileUrl,
      "dealer_homepage",
    );
    let links: string[];
    if (homepageCache.cached && homepageCache.listingsCount) {
      onProgress?.({
        type: "status",
        dealer: dealer.name,
        message: `Using cached dealer listing count: ${homepageCache.listingsCount} ads`,
        runId,
      });
      links = [];
      // For cached homepage, still need to fetch listing IDs from DB if they're not being updated
      // For now, we skip re-crawling but this means we rely on previously found listings
    } else {
      links = await collectListingLinks(page, dealer.mobileUrl);
      // Save homepage crawl results to cache
      saveCrawlQueueStatus(db, dealer.id, dealer.mobileUrl, "dealer_homepage", {
        listingsCount: links.length,
        status: "completed",
      });
    }

    const seenMobileIds = links
      .map((link) => link.match(/obiava-(\d+)/)?.[1] || null)
      .filter((value): value is string => Boolean(value));
    onProgress?.({
      type: "status",
      dealer: dealer.name,
      message: `Found ${links.length} listings to save`,
      runId,
      total: links.length,
    });
    let imageCount = 0;

    for (let index = 0; index < links.length; index += 1) {
      const link = links[index];

      const detail = await scrapeListingDetail(page, link, makesMap);

      // Save listing detail crawl results to cache
      saveCrawlQueueStatus(db, dealer.id, link, "listing_detail", {
        mobileId: detail.mobileId,
        price: detail.priceAmount ? Math.floor(detail.priceAmount) : undefined,
        status: "completed",
      });

      const listingDir = path.join(dealerRoot, detail.mobileId);
      await ensureDir(listingDir);
      const { backupId, action } = upsertBackupArtifact(
        db,
        runId,
        dealer.id,
        detail,
      );
      const savedImages = await downloadAllImages(detail.imageUrls, listingDir);
      insertBackupImages(db, backupId, savedImages);
      if (savedImages.length > 0) {
        db.prepare(
          `UPDATE listings SET images_downloaded = 1 WHERE mobile_id = ?`,
        ).run(detail.mobileId);
      }
      let engagement: {
        views: number | null;
        watching: number | null;
        adStatus: "TOP" | "VIP" | "none";
      } | null = null;
      try {
        engagement = await captureEditFormSnapshotWithPage(
          db,
          dealer,
          detail.mobileId,
          dbPath,
          page,
          {
            backupId,
          },
        );

        // Update crawl queue with views from engagement data
        if (engagement?.views != null) {
          saveCrawlQueueStatus(db, dealer.id, link, "listing_detail", {
            views: engagement.views,
          });
        }
      } catch (error) {
        onProgress?.({
          type: "status",
          dealer: dealer.name,
          runId,
          message: `Could not capture edit-form values for ${detail.mobileId}: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
      imageCount += savedImages.length;
      onProgress?.({
        type: "listing",
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
        previewUrl:
          detail.photoThumbUrls[0] || detail.imageUrls[0] || undefined,
        imageCount: savedImages.length,
        views: engagement?.views ?? null,
        watching: engagement?.watching ?? null,
        adStatus: engagement?.adStatus ?? "none",
      });
    }

    if (dealer.own) {
      const reconciliation = reconcileDeletedMobileBgListings(
        db,
        dealer.id,
        seenMobileIds,
      );
      onProgress?.({
        type: "status",
        dealer: dealer.name,
        runId,
        message: `Reconciled own mobile.bg listings: reactivated ${reconciliation.reactivatedCount}, marked ${reconciliation.deletedCount} deleted`,
      });
    }

    const finishedAt = new Date().toISOString();
    db.prepare(
      `
      UPDATE mobilebg_backup_runs
      SET status = 'completed', listings_count = ?, images_count = ?, finished_at = ?, updated_at = ?
      WHERE id = ?
    `,
    ).run(links.length, imageCount, finishedAt, finishedAt, runId);

    const result = {
      runId,
      listingsCount: links.length,
      imagesCount: imageCount,
    };
    onProgress?.({
      type: "complete",
      dealer: dealer.name,
      message: `Saved ${links.length} listings and ${imageCount} images`,
      ...result,
    });
    return result;
  } catch (error) {
    const failedAt = new Date().toISOString();
    db.prepare(
      `
      UPDATE mobilebg_backup_runs
      SET status = 'failed', notes = ?, finished_at = ?, updated_at = ?
      WHERE id = ?
    `,
    ).run(
      error instanceof Error ? error.message : String(error),
      failedAt,
      failedAt,
      runId,
    );
    throw error;
  } finally {
    await browser.close();
  }
}
