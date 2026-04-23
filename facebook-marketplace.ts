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
  mileage?: number;      // km
  fuel?: string;
  color?: string;
  bodyType?: string;     // "Тип каросерия" — e.g. "Хечбек", "Седан", "Джип"
  transmission?: string;
  condition?: string;    // "Състояние" — e.g. "Отлично"
  noDamage?: boolean;    // "Без повреди" checkbox
  vehicleType?: string;  // "Тип превозно средство" — e.g. "Автомобил/камион"
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
    // 8. Vehicle Type (Тип превозно средство) — step 1 of the wizard
    // -----------------------------------------------------------------------
    if (listing.vehicleType) {
      await fillLabelCombobox(page, "Тип превозно средство", listing.vehicleType);
      await delay(600, 900);
    }

    // Click the page heading to close the Vehicle Type dropdown before filling other fields
    await page.locator('h1, h2, [role="heading"]').first().click({ force: true }).catch(() =>
      page.mouse.click(640, 40)
    );
    await delay(600, 900);

    // -----------------------------------------------------------------------
    // 9. Year (Година)
    // -----------------------------------------------------------------------
    if (listing.year) {
      await fillLabelCombobox(page, "Година", String(listing.year));
      await delay(1500, 2000); // wait for dynamic fields to appear
    }

    // -----------------------------------------------------------------------
    // 10. Fields that appear after Year is selected — scroll to reveal them
    // -----------------------------------------------------------------------
    await page.evaluate(() => window.scrollBy(0, 400));
    await delay(600, 900);

    if (listing.mileage) {
      await fillByLabel(page, "Километраж", String(listing.mileage));
      await delay(400, 600);
    }

    if (listing.bodyType) {
      await fillLabelCombobox(page, "Тип каросерия", listing.bodyType);
      await delay(600, 900);
    }

    if (listing.fuel) {
      await fillLabelCombobox(page, "Тип гориво", listing.fuel);
      await delay(600, 900);
    }

    if (listing.color) {
      const colorLabels = ["Цвят на екстериора", "Цвят"];
      for (const label of colorLabels) {
        const found = await fillLabelCombobox(page, label, listing.color);
        if (found) break;
      }
      await delay(600, 900);
    }

    if (listing.transmission) {
      const transmissionLabels = ["Скоростна кутия", "Трансмисия", "Transmission"];
      for (const label of transmissionLabels) {
        const found = await fillLabelCombobox(page, label, listing.transmission);
        if (found) break;
      }
      await delay(600, 900);
    }

    if (listing.condition) {
      await fillLabelCombobox(page, "Състояние", listing.condition);
      await delay(600, 900);
    }

    // "Без повреди" — checkbox/switch
    if (listing.noDamage) {
      const noDamageEl = page.locator('[role="switch"], [role="checkbox"]').filter({
        hasText: /без повреди/i,
      }).first();
      const noDamageByLabel = page.locator(
        '[role="switch"][aria-label*="Без повреди"], [role="checkbox"][aria-label*="Без повреди"]'
      ).first();
      const nd = (await noDamageEl.isVisible({ timeout: 1500 }).catch(() => false))
        ? noDamageEl : noDamageByLabel;
      if (await nd.isVisible({ timeout: 1500 }).catch(() => false)) {
        const checked = await nd.getAttribute("aria-checked");
        if (checked !== "true") { await nd.click(); await delay(300, 500); }
        console.log("✓  Enabled: Без повреди");
      } else {
        console.warn("⚠️  Could not find Без повреди checkbox");
      }
    }

    // -----------------------------------------------------------------------
    // 11. "Опции за обявата" — enable "Показване на обявата на всички"
    // -----------------------------------------------------------------------
    await page.evaluate(() => window.scrollBy(0, 600));
    await delay(600, 900);
    const visibilitySwitch = page.locator('[role="switch"]').filter({
      hasText: /показване на обявата на всички/i,
    }).first();
    // Also try by aria-label in case hasText doesn't match the switch element itself
    const visibilitySwitchByLabel = page.locator(
      '[role="switch"][aria-label*="Показване на обявата на всички"]'
    ).first();
    const sw = (await visibilitySwitch.isVisible({ timeout: 2000 }).catch(() => false))
      ? visibilitySwitch
      : visibilitySwitchByLabel;
    if (await sw.isVisible({ timeout: 2000 }).catch(() => false)) {
      const isOn = await sw.getAttribute("aria-checked");
      if (isOn !== "true") {
        await sw.click();
        await delay(300, 500);
        console.log("✓  Enabled: Показване на обявата на всички");
      } else {
        console.log("✓  Already enabled: Показване на обявата на всички");
      }
    } else {
      console.warn("⚠️  Could not find visibility switch");
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
async function fillLabelCombobox(page: Page, labelText: string, value: string): Promise<boolean> {
  const handle = await page.evaluateHandle((label) => {
    // FB renders the label text directly as the label element's innerText.
    // Also check parents in case the text is in a sibling span.
    const els = Array.from(document.querySelectorAll('label[role="combobox"]')) as HTMLElement[];
    for (const el of els) {
      if (el.textContent?.includes(label)) return el;
      let node = el.parentElement;
      for (let depth = 0; depth < 6 && node; depth++) {
        if (node.textContent?.includes(label)) return el;
        node = node.parentElement;
      }
    }
    return null;
  }, labelText);

  const el = handle.asElement();
  if (!el) {
    return false;
  }

  await el.click();
  await delay(1200, 1600);

  // Use JS evaluation to find and click a visible item whose trimmed text matches.
  // This is more reliable than Playwright locators for FB portal dropdowns.
  const clicked = await page.evaluate((val) => {
    const selectors = ['[role="option"]', 'li', '[role="listitem"]', 'div[tabindex]', 'span[tabindex]', 'div[role="button"]'];
    for (const sel of selectors) {
      const items = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
      const visible = items.filter(
        (e) => e.offsetWidth > 0 && e.offsetHeight > 0
      );
      // Exact match
      const exact = visible.find(
        (e) => e.textContent?.trim() === val
      );
      if (exact) { exact.click(); return `exact:${sel}`; }
      // Partial match — only if text is short enough to avoid false positives
      const partial = visible.find(
        (e) => {
          const t = e.textContent?.trim() ?? "";
          return t.length < 60 && t.toLowerCase().includes(val.toLowerCase());
        }
      );
      if (partial) { partial.click(); return `partial:${sel}`; }
    }
    return null;
  }, value);

  // Debug: if not found, log what IS visible and take a screenshot
  if (!clicked) {
    const visible = await page.evaluate(() => {
      const selectors = ['[role="option"]', 'li', 'div[tabindex]'];
      const found: string[] = [];
      for (const sel of selectors) {
        const items = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
        const texts = items
          .filter(e => e.offsetWidth > 0 && e.offsetHeight > 0)
          .map(e => e.textContent?.trim().slice(0, 40))
          .filter(Boolean).slice(0, 10);
        if (texts.length) found.push(`${sel}: ${texts.join(" | ")}`);
      }
      return found;
    });
    if (visible.length) console.log(`  Visible options: ${visible.join("\n    ")}`);
    await page.screenshot({ path: `/tmp/fb-dropdown-${labelText}.png` }).catch(() => {});
  }

  if (clicked) {
    console.log(`  ✓ Selected "${value}" via ${clicked}`);
    await delay(400, 600);
    // Dismiss the dropdown — FB keeps it open after selection
    await page.keyboard.press("Escape").catch(() => {});
    await delay(400, 600);
    return true;
  }

  // Fallback: type to filter (some dropdowns have a search input)
  const dialog = page.locator('[role="dialog"], [role="listbox"]');
  const searchInput = dialog.locator("input").first();
  if (await searchInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    await searchInput.fill(value);
    await delay(900, 1300);
    const clicked2 = await page.evaluate((val) => {
      const items = Array.from(document.querySelectorAll('[role="option"], li')) as HTMLElement[];
      const match = items.filter(e => e.offsetWidth > 0).find(
        e => {
          const t = e.textContent?.trim() ?? "";
          return t.length < 60 && t.toLowerCase().includes(val.toLowerCase());
        }
      );
      if (match) { match.click(); return true; }
      return false;
    }, value);
    if (clicked2) { await delay(300, 500); return true; }
  }

  console.warn(`⚠️  No option matched "${value}" for "${labelText}" — closing dropdown`);
  await page.keyboard.press("Escape").catch(() => {});
  return false;
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
