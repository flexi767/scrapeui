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

import * as fs from "fs";
import type { Page } from "playwright";
import { fillByLabel, fillLabelCombobox, fillLocation } from "./field-fillers";
import { launchMarketplaceContext } from "./session";
import { delay } from "./timing";
import type { MarketplaceListing, MarketplacePostResult } from "./types";

export type { MarketplaceListing } from "./types";

export async function postToFacebookMarketplace(
  listing: MarketplaceListing
): Promise<MarketplacePostResult> {
  let page: Page | null = null;

  async function waitForPageClose() {
    if (page) await page.waitForEvent("close", { timeout: 0 }).catch(() => {});
  }

  try {
    ({ page } = await launchMarketplaceContext());

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
    // 3. Make (Марка) — combobox with predefined FB options
    // -----------------------------------------------------------------------
    if (listing.make) {
      await fillLabelCombobox(page, "Марка", listing.make);
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
    const activePage = page;
    await activePage.locator('h1, h2, [role="heading"]').first().click({ force: true }).catch(() =>
      activePage.mouse.click(640, 40)
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
      await fillByLabel(page, "Пробег", String(listing.mileage));
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
      // FB label includes colon: "Състояние на превозното средство:"
      await fillLabelCombobox(page, "Състояние", listing.condition);
      await delay(600, 900);
    }

    // "Без повреди" — native checkbox with specific aria-label
    if (listing.noDamage) {
      const nd = page.locator(
        'input[aria-label*="Без повреди"], [role="checkbox"][aria-label*="Без повреди"]'
      ).first();
      if (await nd.isVisible({ timeout: 2000 }).catch(() => false)) {
        const checked = await nd.evaluate((el) =>
          (el as HTMLInputElement).checked || el.getAttribute("aria-checked") === "true"
        );
        if (!checked) { await nd.click(); await delay(300, 500); }
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
