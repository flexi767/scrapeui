import type { Page } from "playwright";
import { logger } from "@/lib/logger";
import { delay } from "./timing";

const log = logger.child("fb-fill");

/**
 * Fill a plain text input or textarea found by walking up <=4 parent levels
 * looking for the label text.
 */
export async function fillByLabel(page: Page, labelText: string, value: string): Promise<void> {
  const handle = await page.evaluateHandle((label) => {
    const candidates = Array.from(document.querySelectorAll(
      "input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=search]), textarea",
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
    log.warn(`Could not find field with label "${labelText}"`);
    return;
  }
  await el.click({ clickCount: 3 }).catch(() => {});
  await delay(150, 250);
  await el.fill(value).catch(() => {});
  await delay(200, 400);
}

/**
 * Click a LABEL[role=combobox] dropdown and select the option matching value.
 *
 * FB renders dropdown options in a [role="listbox"] portal that is separate
 * from the always-present vehicle-type sidebar [role="option"] items. We must
 * wait for that listbox to appear and search exclusively within it.
 */
export async function fillLabelCombobox(page: Page, labelText: string, value: string): Promise<boolean> {
  await page.keyboard.press("Escape").catch(() => {});
  await delay(300, 400);

  const handle = await page.evaluateHandle((label) => {
    const els = Array.from(document.querySelectorAll('label[role="combobox"]')) as HTMLElement[];
    for (const el of els) {
      if (el.textContent?.includes(label)) return el;
    }
    return null;
  }, labelText);

  const el = handle.asElement();
  if (!el) return false;

  await el.evaluate((node) => node.scrollIntoView({ block: "center" })).catch(() => {});
  await delay(200, 300);
  await el.click();

  const listboxAppeared = await page
    .waitForSelector('[role="listbox"]', { timeout: 3000 })
    .then(() => true)
    .catch(() => false);

  await delay(listboxAppeared ? 400 : 1200, listboxAppeared ? 600 : 1600);

  const clicked = await page.evaluate((val) => {
    const listbox = document.querySelector('[role="listbox"]');
    const roots: (Element | Document)[] = listbox ? [listbox] : [document];

    for (const root of roots) {
      for (const sel of ['[role="option"]', "li", 'div[tabindex="0"]']) {
        const items = Array.from(root.querySelectorAll(sel)) as HTMLElement[];
        const visible = items.filter((item) => item.offsetWidth > 0 && item.offsetHeight > 0);

        const exact = visible.find((item) => item.textContent?.trim() === val);
        if (exact) {
          exact.click();
          return `exact:${sel}`;
        }

        const partial = visible.find((item) => {
          const text = item.textContent?.trim() ?? "";
          return text.length < 80 && text.toLowerCase().includes(val.toLowerCase());
        });
        if (partial) {
          partial.click();
          return `partial:${sel}`;
        }
      }
    }
    return null;
  }, value);

  if (clicked) {
    log.info(`  Selected "${value}" via ${clicked}`);
    await delay(400, 600);
    await page.keyboard.press("Escape").catch(() => {});
    await delay(300, 500);
    return true;
  }

  if (listboxAppeared) {
    const searchInput = page.locator('[role="listbox"] input').first();
    if (await searchInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await searchInput.fill(value);
      await delay(900, 1300);
      const clickedViaSearch = await page.evaluate((val) => {
        const listbox = document.querySelector('[role="listbox"]');
        if (!listbox) return false;
        const items = Array.from(listbox.querySelectorAll('[role="option"], li')) as HTMLElement[];
        const match = items.filter((item) => item.offsetWidth > 0).find((item) => {
          const text = item.textContent?.trim() ?? "";
          return text.length < 80 && text.toLowerCase().includes(val.toLowerCase());
        });
        if (match) {
          match.click();
          return true;
        }
        return false;
      }, value);
      if (clickedViaSearch) {
        log.info(`  Selected "${value}" via search input`);
        await delay(300, 500);
        return true;
      }
    }
  }

  const visibleOptions = await page.evaluate(() => {
    const listbox = document.querySelector('[role="listbox"]');
    if (!listbox) return "(no listbox)";
    const items = Array.from(listbox.querySelectorAll('[role="option"], li')) as HTMLElement[];
    return items
      .filter((item) => item.offsetWidth > 0)
      .map((item) => item.textContent?.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 15)
      .join(" | ");
  });
  log.info(`  Listbox options for "${labelText}": ${visibleOptions}`);
  await page.screenshot({ path: `/tmp/fb-dropdown-${labelText}.png` }).catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});
  await delay(300, 400);
  log.warn(`No option matched "${value}" for "${labelText}"`);
  return false;
}

export async function fillLocation(page: Page, location: string): Promise<void> {
  const input = page.locator('[aria-label="Местоположение"]').first();
  if (!await input.isVisible({ timeout: 3000 }).catch(() => false)) {
    log.warn("Location field not visible");
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
