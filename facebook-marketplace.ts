/**
 * Facebook Marketplace – pre-fill helper
 *
 * Opens a persistent browser session, navigates to the "Create listing" flow,
 * fills every field, uploads photos, then PAUSES and waits for you to click
 * Publish manually.  Never submits on your behalf.
 *
 * Usage:
 *   npx tsx facebook-marketplace.ts
 *
 * Or import postToFacebookMarketplace() and call it from scrapeui's API route.
 *
 * Prerequisites:
 *   npm install playwright
 *   npx playwright install chromium
 *
 * First run: set HEADLESS=false, log in manually, complete any 2FA.
 * The session is saved outside the app directory and reused on subsequent runs.
 */

import { chromium, BrowserContext, Page } from "playwright";
import * as path from "path";
import * as fs from "fs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarketplaceListing {
  title: string;
  price: number; // EUR, will be entered as plain number
  description: string;
  category?: MarketplaceCategory;
  condition?: "new" | "used_like_new" | "used_good" | "used_fair";
  location?: string; // shown as hint; FB uses account location by default
  photos: string[]; // absolute local paths, max 10
}

export type MarketplaceCategory =
  | "vehicles"
  | "electronics"
  | "apparel"
  | "garden"
  | "hobbies"
  | "home_sales"
  | "musical_instruments"
  | "office_supplies"
  | "sporting_goods"
  | "toys_games"
  | "video_games"
  | "other";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SESSION_DIR =
  process.env.FB_SESSION_DIR ||
  path.resolve(__dirname, "storage", "fb-session");
const HEADLESS = process.env.HEADLESS === "true"; // default: visible
const SLOW_MO = 120; // ms between actions — looks more human

// Human-like random delay
const delay = (min: number, max: number) =>
  new Promise((r) =>
    setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min)
  );

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

export async function postToFacebookMarketplace(
  listing: MarketplaceListing
): Promise<{ status: "ready_to_publish" | "error"; message: string }> {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  let context: BrowserContext | null = null;

  try {
    context = await chromium.launchPersistentContext(SESSION_DIR, {
      headless: HEADLESS,
      slowMo: SLOW_MO,
      viewport: { width: 1280, height: 900 },
      locale: "en-US",
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
      ],
      // Suppress "automation" flag
      ignoreDefaultArgs: ["--enable-automation"],
    });

    const page = await context.newPage();

    // Remove webdriver property that FB checks
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    // -----------------------------------------------------------------------
    // 1. Check login
    // -----------------------------------------------------------------------
    await page.goto("https://www.facebook.com", { waitUntil: "domcontentloaded" });
    await delay(1000, 2000);

    const isLoggedIn = await page
      .locator('[aria-label="Your profile"]')
      .isVisible()
      .catch(() => false);

    if (!isLoggedIn) {
      return {
        status: "error",
        message:
          "Not logged in. Run with HEADLESS=false, log in manually, then retry. Session will be saved for future runs.",
      };
    }

    // -----------------------------------------------------------------------
    // 2. Navigate to Create Listing
    // -----------------------------------------------------------------------
    await page.goto(
      "https://www.facebook.com/marketplace/create/vehicle",
      { waitUntil: "domcontentloaded" }
    );
    await delay(2000, 3500);

    // -----------------------------------------------------------------------
    // 3. Photos
    // -----------------------------------------------------------------------
    const photoPaths = listing.photos
      .slice(0, 10)
      .filter((p) => fs.existsSync(p));

    if (photoPaths.length === 0) {
      return { status: "error", message: "No valid photo paths provided." };
    }

    // FB Marketplace "Add photos" button — selector may need updating
    const photoInput = page.locator('input[type="file"][accept*="image"]').first();
    if (await photoInput.isVisible().catch(() => false)) {
      await photoInput.setInputFiles(photoPaths);
    } else {
      // Try clicking the visible button which reveals the hidden input
      const addPhotosBtn = page
        .locator('[aria-label="Add photos"]')
        .first();
      if (await addPhotosBtn.isVisible()) {
        const [fileChooser] = await Promise.all([
          page.waitForEvent("filechooser"),
          addPhotosBtn.click(),
        ]);
        await fileChooser.setFiles(photoPaths);
      }
    }

    await delay(1500, 2500);

    // -----------------------------------------------------------------------
    // 4. Title
    // -----------------------------------------------------------------------
    await fillField(page, [
      '[aria-label="Title"]',
      'input[placeholder*="Title"]',
      'input[name="title"]',
    ], listing.title);

    // -----------------------------------------------------------------------
    // 5. Price
    // -----------------------------------------------------------------------
    await fillField(page, [
      '[aria-label="Price"]',
      'input[placeholder*="Price"]',
      'input[name="price"]',
    ], String(listing.price));

    // -----------------------------------------------------------------------
    // 6. Category (vehicles is default on /create/vehicle; skip if not needed)
    // -----------------------------------------------------------------------
    // Category is pre-set via the URL. If you need a different one, uncomment:
    // await selectCategory(page, listing.category ?? "vehicles");

    // -----------------------------------------------------------------------
    // 7. Condition
    // -----------------------------------------------------------------------
    if (listing.condition) {
      await selectCondition(page, listing.condition);
    }

    // -----------------------------------------------------------------------
    // 8. Description
    // -----------------------------------------------------------------------
    await fillField(page, [
      '[aria-label="Description"]',
      'textarea[placeholder*="Description"]',
      'textarea[name="description"]',
    ], listing.description);

    // -----------------------------------------------------------------------
    // 9. Done — hand control back to the human
    // -----------------------------------------------------------------------
    console.log("\n✅  Form pre-filled.");
    console.log("👀  Review the listing in the browser window.");
    console.log("🖱️   Click [ Publish ] when ready.\n");

    // Keep browser open until the process is killed or the page closes
    await page.waitForEvent("close", { timeout: 0 }).catch(() => {});

    return {
      status: "ready_to_publish",
      message: "Form filled. Waiting for manual publish.",
    };
  } catch (err: unknown) {
    console.error("facebook-marketplace error:", err);
    return {
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
  // Do NOT close context — we're leaving the browser open for the human
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fillField(
  page: Page,
  selectors: string[],
  value: string
): Promise<void> {
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click({ clickCount: 3 }); // select all existing text
      await delay(200, 400);
      await el.fill(value);
      await delay(300, 600);
      return;
    }
  }
  console.warn(`⚠️  Could not find field for selectors: ${selectors.join(", ")}`);
}

async function selectCondition(
  page: Page,
  condition: MarketplaceListing["condition"]
): Promise<void> {
  const labelMap: Record<string, string> = {
    new: "New",
    used_like_new: "Used - Like New",
    used_good: "Used - Good",
    used_fair: "Used - Fair",
  };
  const label = labelMap[condition!];
  if (!label) return;

  // Try a listbox / combobox first
  const conditionSelect = page
    .locator('[aria-label="Condition"]')
    .first();

  if (await conditionSelect.isVisible().catch(() => false)) {
    await conditionSelect.click();
    await delay(400, 700);
    await page
      .locator(`[role="option"]:has-text("${label}")`)
      .first()
      .click()
      .catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  // Example listing — replace with real data or wire up to scrapeui's DB
  const example: MarketplaceListing = {
    title: "BMW 320d 2019 – Automatic – Full Service History",
    price: 25000,
    description:
      "One owner. Full dealer service history. No accidents. " +
      "Sunroof, heated seats, LED headlights. Available for test drive.",
    category: "vehicles",
    condition: "used_good",
    photos: [
      // Replace with absolute paths to actual images
      // path.resolve(__dirname, "photos/car1.jpg"),
      // path.resolve(__dirname, "photos/car2.jpg"),
    ],
  };

  postToFacebookMarketplace(example).then((result) => {
    if (result.status === "error") {
      console.error("❌", result.message);
      process.exit(1);
    }
  });
}
