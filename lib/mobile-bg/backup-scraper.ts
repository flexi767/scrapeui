import fsp from "fs/promises";
import path from "path";
import type { Page } from "playwright";
import { USER_AGENT } from "@/lib/mobile-bg/constants";
import {
  parseMakeModelSync,
  type MakesMap,
} from "@/lib/mobile-bg/makes-models";
import { normalizeImageUrl, toMobileBgFullImageUrl } from "@/lib/mobile-bg/backup-images";
import { cleanDescription } from "@/lib/mobile-bg/description";
import type { ScrapedDetail, ScrapedListingPageData, SavedImage } from "@/lib/mobile-bg/backup-types";

export async function collectListingLinks(
  page: Page,
  dealerUrl: string,
  maxPages = 30,
): Promise<string[]> {
  const links = new Set<string>();

  for (let currentPage = 1; currentPage <= maxPages; currentPage += 1) {
    const url = new URL(dealerUrl);
    if (currentPage > 1) url.searchParams.set("page", String(currentPage));

    await page.goto(url.toString(), {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page
      .waitForSelector('a[href*="/obiava-"]', { timeout: 15000 })
      .catch(() => {});

    const pageLinks = await page.$$eval('a[href*="/obiava-"]', (elements) => [
      ...new Set(
        elements
          .map((el) => (el as HTMLAnchorElement).href)
          .filter((href) => href.includes("/obiava-")),
      ),
    ]);

    pageLinks.forEach((href) => links.add(href));

    const hasNext = await page
      .evaluate(
        (pageNo) =>
          Array.from(document.querySelectorAll("a")).some(
            (a) =>
              a.href.includes(`page=${pageNo + 1}`) ||
              a.textContent?.trim() === String(pageNo + 1),
          ),
        currentPage,
      )
      .catch(() => false);

    if (!hasNext) break;
  }

  return [...links];
}

async function scrapeAllImages(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const normalizeUrl = (value: string) => {
      if (!value) return "";
      try {
        return new URL(value, window.location.href).toString();
      } catch {
        return "";
      }
    };
    const toFullSizeUrl = (source: string) =>
      source
        .replace(/(\/mobile\/photosorg\/\d+)\/(\d+)\/(?!big1)/, "$1/$2/big1/")
        .replace(/\/1\/big1\/big1\//, "/1/big1/");

    const galleryEls = document.querySelectorAll(
      ".smallPicturesGallery img, .smallPicturesGallery [data-lazy], .smallPicturesGallery [data-src]",
    );
    if (galleryEls.length > 0) {
      const seen = new Set<string>();
      const imgs: string[] = [];
      galleryEls.forEach((el) => {
        const source = normalizeUrl(
          el.getAttribute("data-src-gallery") ||
            el.getAttribute("data-lazy") ||
            el.getAttribute("data-src") ||
            (el as HTMLImageElement).src ||
            "",
        );
        const bigSource = toFullSizeUrl(source);
        const canonical = bigSource.includes("/big1/") ? bigSource : source;
        if (
          canonical &&
          !seen.has(canonical) &&
          canonical.includes("photosorg")
        ) {
          seen.add(canonical);
          imgs.push(canonical);
        }
      });
      if (imgs.length > 0) return imgs;
    }

    const seen = new Set<string>();
    const imgs: string[] = [];
    document.querySelectorAll("img, [data-lazy], [data-src]").forEach((el) => {
      const source = normalizeUrl(
        el.getAttribute("data-src-gallery") ||
          el.getAttribute("data-lazy") ||
          el.getAttribute("data-src") ||
          (el as HTMLImageElement).src ||
          "",
      );
      if (!source) return;
      const canonical = toFullSizeUrl(source);
      if (seen.has(canonical)) return;
      const isCarPhoto =
        canonical.includes("/big1/") &&
        /\.(webp|jpg|jpeg|png)(\?|$)/i.test(canonical);
      if (isCarPhoto) {
        seen.add(canonical);
        imgs.push(canonical);
      }
    });
    if (imgs.length > 0) return imgs;

    const html = document.documentElement.innerHTML;
    const regex =
      /https?:\/\/[^"'\\\s]+\/photosorg\/[^"'\\\s]+\/big1\/[^"'\\\s]+\.(?:webp|jpg|jpeg|png)(?:\?[^"'\\\s]*)?/gi;
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

export async function scrapeListingDetail(
  page: Page,
  url: string,
  makesMap: MakesMap | null,
  { includeImages = true }: { includeImages?: boolean } = {},
): Promise<ScrapedDetail> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("h1", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);

  const data = await page.evaluate(String.raw`(() => {
    const normalizeCategoryValue = (value) => {
      if (!value) return null;
      return (
        value
          .split(/\r?\n/)[0]
          .replace(
            /\s+(Пробег|Цвят|Скоростна кутия|Двигател|Мощност|Кубатура).*$/i,
            "",
          )
          .trim() || null
      );
    };

    const body = document.body.innerText;
    const title = document.querySelector("h1")?.textContent?.trim() || "";
    const priceMatch = body.match(/([\d\s.,]+)\s*€/);
    const noVat = body.includes("Не се начислява ДДС");
    const hasVat = !noVat && body.includes("начислява ДДС");
    const readTechDataValue = (label) => {
      const rows = Array.from(
        document.querySelectorAll(".techData .items .item"),
      );
      for (const row of rows) {
        const divs = row.querySelectorAll("div");
        if (divs.length < 2) continue;
        if (divs[0].textContent?.trim() === label) {
          return divs[1].textContent?.trim() || null;
        }
      }
      return null;
    };

    const extract = (pattern) => {
      const match = body.match(pattern);
      return match ? match[1].trim() : null;
    };

    const year = extract(/Дата на производство\s+(.+?)(?:\n|Двигател)/);
    const fuel = extract(/Двигател\s+(\S+)/);
    const power = extract(/Мощност\s+([\d]+)/);
    const engine = extract(/Кубатура[^)]*\)\s*([\d]+)/);
    const transmission = extract(/Скоростна кутия\s+(\S+)/);
    const categoryFromTechData = readTechDataValue("Категория");
    const categoryRaw =
      categoryFromTechData || extract(/Категория\s+(.+?)(?:\n|Пробег|Цвят|$)/);
    const category = normalizeCategoryValue(categoryRaw);
    const mileageFromTechData = readTechDataValue("Пробег");
    const mileageMatch = (mileageFromTechData || body).match(/([\d\s]+)\s*км/);
    const mileage = mileageMatch
      ? mileageMatch[1].replace(/\s/g, "").trim()
      : null;
    const colorFromTechData = readTechDataValue("Цвят");
    const color =
      (colorFromTechData || extract(/Цвят\s+([^\r\n]+)/) || null)
        ?.split(/\r?\n/)[0]
        .trim() || null;
    const description =
      document.querySelector(".moreInfo")?.innerText?.trim() || "";
    const listingId = window.location.href.match(/obiava-(\d+)/)?.[1] || null;
    const phoneMatch = body.match(/тел[.\s]*([0-9\s+\-()]{8,20})/gi);
    const phones = phoneMatch
      ? phoneMatch.map((p) => p.replace(/тел[.\s]*/i, "").trim())
      : [];

    const extras = {};
    const extriEl = document.querySelector(".carExtri");
    if (extriEl) {
      let currentCategory = null;
      for (const child of Array.from(extriEl.childNodes)) {
        if (child.nodeType !== 1) continue;
        const element = child;
        if (element.tagName === "SPAN" && element.classList.contains("Title")) {
          currentCategory = element.textContent?.trim() || null;
          if (currentCategory) extras[currentCategory] = [];
        } else if (
          element.tagName === "DIV" &&
          element.classList.contains("items") &&
          currentCategory
        ) {
          extras[currentCategory] = Array.from(
            element.querySelectorAll("div"),
          ).map((el) => ({
            label: el.textContent?.trim() || "",
            alias: el.getAttribute("data-title") || null,
          }));
        }
      }
    }

    const techData = {};
    document.querySelectorAll(".techData .items .item").forEach((item) => {
      const divs = item.querySelectorAll("div");
      if (divs.length >= 2) {
        techData[divs[0].textContent?.trim() || ""] =
          divs[1].textContent?.trim() || "";
      }
    });

    const photoOrder = Array.from(
      document.querySelectorAll(
        ".smallPicturesGallery img, .smallPicturesGallery [data-lazy], .smallPicturesGallery [data-src]",
      ),
    )
      .map((el) => {
        const source =
          el.src ||
          el.getAttribute("data-lazy") ||
          el.getAttribute("data-src") ||
          "";
        const keyMatch = source.match(/_([^_/]+)\.webp/);
        return keyMatch ? keyMatch[1] : null;
      })
      .filter(Boolean);

    const photoThumbUrls = Array.from(
      document.querySelectorAll(
        ".smallPicturesGallery img, .smallPicturesGallery [data-lazy], .smallPicturesGallery [data-src]",
      ),
    )
      .map(
        (el) =>
          el.src ||
          el.getAttribute("data-lazy") ||
          el.getAttribute("data-src") ||
          "",
      )
      .filter(Boolean);

    return {
      title,
      price: priceMatch
        ? priceMatch[1].replace(/\s/g, "").replace(",", ".")
        : null,
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
  })()`) as ScrapedListingPageData;

  const scrapedImageUrls = includeImages ? await scrapeAllImages(page) : [];
  const mobileId =
    url.match(/obiava-(\d+)/)?.[1] || data.listingId || String(Date.now());
  const imageUrls =
    !includeImages
      ? []
      : scrapedImageUrls.length > 0
      ? scrapedImageUrls
      : data.photoThumbUrls
          .map((thumbUrl) => toMobileBgFullImageUrl(thumbUrl))
          .filter((value): value is string => Boolean(value));
  const cleanedTitle = data.title.replace(/\s*Обява:\s*\d+\s*$/i, "").trim();
  const parsed = parseMakeModelSync(cleanedTitle, makesMap);

  return {
    mobileId,
    url,
    sourceTitle: cleanedTitle,
    make: parsed.make,
    model: parsed.model,
    title: parsed.titleRemainder.replace(/\s*Обява:\s*\d+\s*$/i, "").trim(),
    priceAmount: data.price ? parseFloat(data.price) : null,
    priceCurrency: "EUR",
    vat: data.hasVat ? "included" : data.noVat ? "exempt" : null,
    year: data.year
      ? parseInt(data.year.match(/\d{4}/)?.[0] || "", 10) || null
      : null,
    mileage: data.mileage ? parseInt(data.mileage, 10) || null : null,
    fuel: data.fuel || null,
    power: data.power ? parseInt(data.power, 10) || null : null,
    engine: data.engine ? `${data.engine} см³` : null,
    color: data.color || null,
    transmission: data.transmission || null,
    category: data.category || null,
    description: cleanDescription(data.description),
    phones: data.phones,
    extras: data.extras,
    techData: data.techData,
    photoOrder: data.photoOrder,
    photoThumbUrls: data.photoThumbUrls,
    imageUrls,
  };
}

export async function downloadAllImages(
  urls: string[],
  destDir: string,
): Promise<SavedImage[]> {
  const saved: SavedImage[] = [];
  const validUrls = urls
    .map((url) => normalizeImageUrl(url))
    .filter((url): url is string => Boolean(url))
    .filter((url) => {
      if (!url) return false;
      if (!/\.(webp|jpg|jpeg|png)(\?|$)/i.test(url)) return false;
      if (!url.includes("/big1/") && !url.includes("/snimka/")) return false;
      return true;
    });

  for (let i = 0; i < validUrls.length; i += 1) {
    const imageUrl = validUrls[i];
    const filename = `${String(i + 1).padStart(2, "0")}.webp`;
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
      const res = await fetch(imageUrl, {
        headers: { "User-Agent": USER_AGENT },
      });
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
