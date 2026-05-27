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
import type { MakesMap } from "@/lib/mobile-bg/makes-models";
import { cleanDescription } from "@/lib/mobile-bg/description";
import {
  extractMobileBgDetailFromDocument,
  extractMobileBgListCardsFromDocument,
} from "@/lib/mobile-bg/dom-extractors";
import { reconcileDeletedMobileBgListings } from "@/lib/mobile-bg/reconcile-deleted";
import {
  downloadMobileBgDraftImages,
  seedMobileBgDraftBackup,
} from "@/lib/mobile-bg/draft-backups";
import {
  extractMobileId,
  upsertMobileBgListing,
  type ScrapedMobileBgListingInput,
} from "@/lib/mobile-bg/listing-persistence";
import {
  normalizeMobileDetailUrl,
  parseFirstInteger,
  parseLabeledBodyText,
  parseMobileBgEuroPrice,
  parseMobileBgLastEdit,
  parseMobileBgVatStatus,
  parseSingleWordLabel,
} from "@/lib/mobile-bg/scrape-parsing";
import {
  emit,
  formatError,
  parseRunnerArgs,
  openDb,
  fetchRunnerRefData,
} from "@/scraper/lib/runner";
import { createCrawlRun, updateCrawlRun } from "@/lib/query-modules/mobilebg";
import { currentIsoTimestamp, formatDateInputValue } from "@/lib/date-format";

const { deepCrawl, downloadImages, requestedSlugs } = parseRunnerArgs();
const HOMEPAGE_CATEGORY_OPTIONS = new Set(["Ван", "Джип", "Кабрио", "Комби", "Купе", "Миниван", "Пикап", "Седан", "Стреч лимузина", "Хечбек"]);

interface DealerRow {
  id: number;
  slug: string;
  name: string;
  mobileBg: string;
  own: number; // 1 = own dealer, 0 = competitor
  mobile_user: string | null;
}

async function upsertAndEmitMobileBgListing(
  db: Database.Database,
  dealer: DealerRow,
  listing: ScrapedMobileBgListingInput,
  makesMap: MakesMap | null,
  fuelMap: Map<string, string> | null,
  transmissionMap: Map<string, string> | null,
  emitData: {
    price: number | null;
    url: string;
    thumb: string;
    imageCount: number;
    views: number | null;
  },
) {
  const result = await upsertMobileBgListing(
    db,
    dealer.id,
    listing,
    makesMap,
    fuelMap,
    transmissionMap,
  );
  if (result.changeEvent) emit(result.changeEvent);
  emit({
    type: "listing",
    dealer: dealer.slug,
    make: result.make,
    model: result.model,
    title: result.title,
    price: emitData.price,
    url: emitData.url,
    thumb: emitData.thumb,
    newListing: result.action === "inserted",
    imageCount: emitData.imageCount,
    views: emitData.views,
  });
  return result;
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
  const snapshotDate = formatDateInputValue();
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

        const cards = await page.evaluate(extractMobileBgListCardsFromDocument);

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
            const priceAmount = parseMobileBgEuroPrice(card.priceText);
            const bodyType =
              card.bodyType && HOMEPAGE_CATEGORY_OPTIONS.has(card.bodyType)
                ? card.bodyType
                : null;
            const vat = parseMobileBgVatStatus(card.vatText);
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
              mileage: parseFirstInteger(card.mileage),
              fuel: card.fuel || null,
              transmission: card.transmission || null,
              thumb: card.thumb || "",
              price: { amount: priceAmount, currency: "EUR" },
              vat,
              lastEdit: null,
              isNew: false,
              imageCount: card.imageCount || 0,
              images: { meta: null, thumbKeys: [], fullKeys: [] },
              scrapedAt: currentIsoTimestamp(),
              source: "mobile.bg",
              dealer: dealer.slug,
              snapshotDate,
            };
            await upsertAndEmitMobileBgListing(
              db,
              dealer,
              listing,
              makesMap,
              fuelMap,
              transmissionMap,
              {
                price: priceAmount,
                url: card.url,
                thumb: card.thumb || "",
                imageCount: card.imageCount || 0,
                views: null,
              },
            );
            count++;
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

          const raw = await page.evaluate(extractMobileBgDetailFromDocument);

          const priceAmount = parseMobileBgEuroPrice(raw.priceText);
          const vat = parseMobileBgVatStatus(raw.vatText);
          const extract = (label: string) => parseLabeledBodyText(raw.bodyText, label);
          const mileageRaw = extract("Пробег \\[км\\]");
          const powerRaw = extract("Мощност");
          const vinRaw = extract("VIN номер");
          const euronormRaw = extract("Евростандарт");
          const { isNew, lastEdit, views } = parseMobileBgLastEdit(raw.statistikiText);

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
            mileage: parseFirstInteger(mileageRaw),
            color: extract("Цвят"),
            fuel: extract("Двигател"),
            vin: vinRaw ? vinRaw.split(/\s+/)[0] : null,
            euronorm: euronormRaw
              ? parseInt(euronormRaw.match(/(\d+)/)?.[1] || "", 10) || null
              : null,
            extras: raw.extras,
            bodyType: parseSingleWordLabel(raw.bodyText, "Категория"),
            transmission: extract("Скоростна кутия"),
            power: parseFirstInteger(powerRaw),
            description: cleanDescription(raw.description),
            imageCount: raw.thumbKeys.length,
            images: {
              meta: raw.imgMeta,
              thumbKeys: raw.thumbKeys,
              fullKeys: raw.fullKeys,
            },
            scrapedAt: currentIsoTimestamp(),
            source: "mobile.bg",
            dealer: dealer.slug,
            snapshotDate,
          };
          const result = await upsertAndEmitMobileBgListing(
            db,
            dealer,
            listing,
            makesMap,
            fuelMap,
            transmissionMap,
            {
              price: priceAmount,
              url,
              thumb: raw.firstThumbUrl || request.userData?.thumb || "",
              imageCount: raw.thumbKeys.length,
              views,
            },
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
              const backupId = seedMobileBgDraftBackup(
                db,
                dealer,
                listing,
                listingDbId,
                result.make ?? null,
                result.model ?? null,
              );
              if (backupId && downloadImages && raw.fullUrls.length > 0) {
                const counts = await downloadMobileBgDraftImages(
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
