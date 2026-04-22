/**
 * Facebook Marketplace – pre-fill helper
 *
 * Opens a persistent browser session, navigates to the "Create listing" flow,
 * fills every field, uploads photos, then PAUSES and waits for you to click
 * Publish manually.  Never submits on your behalf.
 *
 * Prerequisites:
 *   npm install playwright
 *   npx playwright install chromium
 *
 * First run: set HEADLESS=false, log in manually, complete any 2FA.
 * The session is saved and reused on subsequent runs.
 */

import { chromium, Page } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarketplaceListing {
  title: string;         // used for display / reference only — FB vehicle form has no title field
  price: number;
  description: string;
  make?: string;
  model?: string;
  year?: number;
  transmission?: string;
  vehicleType?: string;  // "Тип превозно средство" — e.g. "Джип", "Седан", "Хечбек"
  location?: string;     // overrides the FB account location if provided
  photos: string[];
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SESSION_DIR =
  process.env.FB_SESSION_DIR ||
  path.resolve(__dirname, "storage", "fb-session");
const HEADLESS = process.env.HEADLESS === "true";
const SLOW_MO = 80;

const delay = (min: number, max: number) =>
  new Promise((r) =>
    setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min)
  );

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

function clearProfileLock(profileDir: string): void {
  try { execSync(`pkill -f ${JSON.stringify(profileDir)} 2>/dev/null || true`); } catch { /* ok */ }
  try { execSync("sleep 0.8"); } catch { /* ok */ }
  const lockFile = path.join(profileDir, "SingletonLock");
  try { fs.unlinkSync(lockFile); } catch { /* not present */ }
}

export async function postToFacebookMarketplace(
  listing: MarketplaceListing
): Promise<{ status: "ready_to_publish" | "error"; message: string }> {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  let page: Page | null = null;

  async function waitForPageClose() {
    if (page) await page.waitForEvent("close", { timeout: 0 }).catch(() => {});
  }

  try {
    clearProfileLock(SESSION_DIR);

    const context = await chromium.launchPersistentContext(SESSION_DIR, {
      headless: HEADLESS,
      slowMo: SLOW_MO,
      viewport: { width: 1280, height: 900 },
      locale: "en-US",
      args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
      ignoreDefaultArgs: ["--enable-automation"],
    });

    const existingPages = context.pages();
    page = existingPages.length > 0 ? existingPages[0] : await context.newPage();

    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    // -----------------------------------------------------------------------
    // 1. Navigate to Create Vehicle Listing
    // -----------------------------------------------------------------------
    await page.goto(
      "https://www.facebook.com/marketplace/create/vehicle",
      { waitUntil: "domcontentloaded" }
    );
    await page.waitForLoadState("networkidle").catch(() => {});
    await delay(2500, 3500);

    const url = page.url();
    const isLoggedIn =
      !url.includes("/login") &&
      !url.includes("login.php") &&
      !url.includes("/checkpoint");

    if (!isLoggedIn) {
      console.log(
        "\n⚠️  Not logged in — log in manually in the browser, then close it.\n"
      );
      await waitForPageClose();
      return { status: "error", message: "Not logged in. Session saved — retry." };
    }

    if (!page.url().includes("/marketplace/create")) {
      console.log("⚠️  Redirected away — retrying navigation…");
      await page.goto(
        "https://www.facebook.com/marketplace/create/vehicle",
        { waitUntil: "domcontentloaded" }
      );
      await page.waitForLoadState("networkidle").catch(() => {});
      await delay(2000, 2500);
    }

    // -----------------------------------------------------------------------
    // 2. Photos
    // -----------------------------------------------------------------------
    const photoPaths = listing.photos.slice(0, 10).filter((p) => fs.existsSync(p));
    if (photoPaths.length === 0) {
      console.warn("⚠️  No valid photo paths — skipping upload.");
    } else {
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(photoPaths).catch((e) =>
        console.warn("⚠️  Photo upload failed:", e.message)
      );
      await delay(2500, 3500);
    }

    // Fill plain text fields FIRST — before any combobox interactions that
    // trigger React re-renders and may restructure the DOM.

    // -----------------------------------------------------------------------
    // 3. Make (Марка) — plain text input
    // -----------------------------------------------------------------------
    if (listing.make) {
      await fillByLabel(page, "Марка", listing.make);
      await delay(400, 600);
    }

    // -----------------------------------------------------------------------
    // 4. Model (Модел) — plain text input
    // -----------------------------------------------------------------------
    if (listing.model) {
      await fillByLabel(page, "Модел", listing.model);
      await delay(400, 600);
    }

    // -----------------------------------------------------------------------
    // 5. Price (Цена)
    // -----------------------------------------------------------------------
    await fillByLabel(page, "Цена", String(listing.price));

    // -----------------------------------------------------------------------
    // 6. Description (Описание)
    // -----------------------------------------------------------------------
    await fillByLabel(page, "Описание", listing.description);

    // -----------------------------------------------------------------------
    // 7. Location (Местоположение) — direct aria-label selector
    // -----------------------------------------------------------------------
    if (listing.location) {
      await fillLocation(page, listing.location);
      await delay(600, 900);
    }

    // -----------------------------------------------------------------------
    // 8. Vehicle Type (Тип превозно средство) — LABEL combobox
    // -----------------------------------------------------------------------
    if (listing.vehicleType) {
      await fillLabelCombobox(page, "Тип превозно средство", listing.vehicleType);
      await delay(800, 1200);
    }

    // -----------------------------------------------------------------------
    // 9. Year (Година) — LABEL combobox
    // -----------------------------------------------------------------------
    if (listing.year) {
      await fillLabelCombobox(page, "Година", String(listing.year));
      await delay(800, 1200);
    }

    // -----------------------------------------------------------------------
    // 10. Transmission — scroll down and look for it (may appear after Year)
    // -----------------------------------------------------------------------
    if (listing.transmission) {
      await page.evaluate(() => window.scrollBy(0, 400));
      await delay(600, 900);
      await fillLabelCombobox(page, "Скоростна кутия", listing.transmission);
    }

    // Save a screenshot so we can verify what got filled
    await page.screenshot({ path: "/tmp/fb-filled.png" }).catch(() => {});
    console.log("📸  Screenshot saved to /tmp/fb-filled.png");

    console.log("\n✅  Form pre-filled.");
    console.log("👀  Review the listing in the browser window.");
    console.log("🖱️   Click [ Publish ] when ready.\n");

    await waitForPageClose();
    return { status: "ready_to_publish", message: "Form filled. Waiting for manual publish." };
  } catch (err: unknown) {
    console.error("facebook-marketplace error:", err);
    await waitForPageClose();
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fill a plain text input or textarea found by walking up ≤4 parent levels
 * looking for the label text.
 */
async function fillByLabel(page: Page, labelText: string, value: string): Promise<void> {
  const handle = await page.evaluateHandle((label) => {
    const candidates = Array.from(document.querySelectorAll(
      "input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=search]), textarea"
    )) as HTMLElement[];
    for (const el of candidates) {
      let node = el.parentElement;
      for (let depth = 0; depth < 4 && node; depth++) {
        if (node.textContent?.includes(label)) return el;
        node = node.parentElement;
      }
    }
    return null;
  }, labelText);

  const el = handle.asElement();
  if (!el) {
    console.warn(`⚠️  Could not find field with label "${labelText}"`);
    return;
  }
  await el.click({ clickCount: 3 }).catch(() => {});
  await delay(150, 250);
  await el.fill(value).catch(() => {});
  await delay(200, 400);
}

/**
 * Click a LABEL[role=combobox] dropdown (used by FB for Vehicle Type, Year,
 * Transmission) and select the option matching value.
 */
async function fillLabelCombobox(page: Page, labelText: string, value: string): Promise<void> {
  const handle = await page.evaluateHandle((label) => {
    // FB renders these as <label role="combobox"> inside a wrapper div that
    // contains the label text as a sibling span.
    const els = Array.from(document.querySelectorAll('label[role="combobox"]')) as HTMLElement[];
    for (const el of els) {
      let node = el.parentElement;
      for (let depth = 0; depth < 4 && node; depth++) {
        if (node.textContent?.includes(label)) return el;
        node = node.parentElement;
      }
    }
    return null;
  }, labelText);

  const el = handle.asElement();
  if (!el) {
    console.warn(`⚠️  Could not find combobox for "${labelText}"`);
    return;
  }

  await el.click();
  await delay(600, 900);

  // Options may be rendered at page root (portal) — search broadly
  const option = page.locator('[role="option"]')
    .filter({ hasText: new RegExp(value, "i") })
    .first();

  if (await option.isVisible({ timeout: 4000 }).catch(() => false)) {
    await option.click();
    await delay(300, 500);
    return;
  }

  // Some dropdowns show a search input inside a dialog — try typing to filter
  const dialog = page.locator('[role="dialog"], [role="listbox"]');
  const searchInput = dialog.locator("input").first();
  if (await searchInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    await searchInput.type(value, { delay: 60 });
    await delay(900, 1300);
    const filtered = page.locator('[role="option"]')
      .filter({ hasText: new RegExp(value, "i") })
      .first();
    if (await filtered.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filtered.click();
      await delay(300, 500);
      return;
    }
  }

  console.warn(`⚠️  No option matched "${value}" for "${labelText}" — closing dropdown`);
  await page.keyboard.press("Escape").catch(() => {});
}

/**
 * Fill an autocomplete text input (Make, Model): type the value slowly,
 * wait for suggestions, click the match.
 */
async function fillAutocomplete(page: Page, labelText: string, value: string): Promise<void> {
  const handle = await page.evaluateHandle((label) => {
    const candidates = Array.from(document.querySelectorAll(
      "input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=search])"
    )) as HTMLElement[];
    for (const el of candidates) {
      let node = el.parentElement;
      for (let depth = 0; depth < 4 && node; depth++) {
        if (node.textContent?.includes(label)) return el;
        node = node.parentElement;
      }
    }
    return null;
  }, labelText);

  const el = handle.asElement();
  if (!el) {
    console.warn(`⚠️  Could not find autocomplete for "${labelText}"`);
    return;
  }

  await el.click({ clickCount: 3 }).catch(() => {});
  await delay(150, 250);
  await el.fill("").catch(() => {});
  await el.type(value, { delay: 70 }).catch(async () => {
    await el.fill(value).catch(() => {});
  });
  await delay(1500, 2000);

  // Wait for suggestions to appear
  try {
    await page.waitForSelector('[role="option"]', { timeout: 3000 });
  } catch {
    // No suggestions appeared
  }

  const option = page.locator('[role="option"]')
    .filter({ hasText: new RegExp(value, "i") })
    .first();

  if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
    await option.click();
    await delay(400, 600);
    return;
  }

  // Fallback: ArrowDown + Enter to accept the first suggestion
  console.warn(`⚠️  No option matched "${value}" for "${labelText}" — trying ArrowDown+Enter`);
  await el.press("ArrowDown").catch(() => {});
  await delay(300, 400);
  await el.press("Enter").catch(() => {});
  await delay(300, 400);
}

/**
 * Fill the location autocomplete using its aria-label.
 */
async function fillLocation(page: Page, location: string): Promise<void> {
  const input = page.locator('[aria-label="Местоположение"]').first();
  if (!await input.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.warn("⚠️  Location field not visible");
    return;
  }
  await input.click({ clickCount: 3 });
  await delay(150, 250);
  await input.fill(location);
  await delay(1200, 1800);

  const option = page.locator('[role="option"]').first();
  if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
    await option.click();
  } else {
    await input.press("Enter");
  }
  await delay(300, 500);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  const example: MarketplaceListing = {
    title: "BMW 320d 2019",
    price: 25000,
    make: "BMW",
    model: "3 Series",
    year: 2019,
    transmission: "Автоматична",
    vehicleType: "Седан",
    description: "One owner. Full dealer service history. No accidents.",
    photos: [],
  };

  postToFacebookMarketplace(example).then((result) => {
    if (result.status === "error") {
      console.error("❌", result.message);
      process.exit(1);
    }
  });
}
