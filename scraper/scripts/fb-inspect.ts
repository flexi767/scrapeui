import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";

const SESSION_DIR = "/Users/v/dev/scrapeui/storage/fb-session";

async function main() {
  try { execSync(`pkill -f ${JSON.stringify(SESSION_DIR)} 2>/dev/null || true`); } catch {}
  try { execSync("sleep 0.8"); } catch {}
  try { fs.unlinkSync(path.join(SESSION_DIR, "SingletonLock")); } catch {}

  const context = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    locale: "en-US",
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    ignoreDefaultArgs: ["--enable-automation"],
  });

  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  await page.goto("https://www.facebook.com/marketplace/create/vehicle", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await new Promise(r => setTimeout(r, 3000));

  // ---- Test 1: click Vehicle Type label combobox and dump options ----
  console.log("\n=== TEST: Vehicle Type dropdown options ===");
  const vtHandle = await page.evaluateHandle(() => {
    const els = Array.from(document.querySelectorAll('label[role="combobox"]')) as HTMLElement[];
    for (const el of els) {
      let node = el.parentElement;
      for (let d = 0; d < 4 && node; d++) {
        if (node.textContent?.includes("Тип превозно средство")) return el;
        node = node.parentElement;
      }
    }
    return null;
  });
  const vtEl = vtHandle.asElement();
  if (vtEl) {
    await vtEl.click();
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: "/tmp/fb-vtype-open.png" });
    const opts = await page.evaluate(() => {
      // Try many possible selectors for dropdown options
      const candidates = [
        '[role="option"]',
        '[role="menuitem"]',
        '[role="listitem"]',
        'li',
        '[data-value]',
      ];
      for (const sel of candidates) {
        const els = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
        const visible = els.filter(e => e.offsetWidth > 0 && e.offsetHeight > 0);
        if (visible.length > 0) {
          return {
            selector: sel,
            items: visible.slice(0, 20).map(e => ({
              role: e.getAttribute("role"),
              text: e.textContent?.trim().slice(0, 60),
            })),
          };
        }
      }
      return null;
    });
    console.log("Vehicle type options:", JSON.stringify(opts, null, 2));
    await page.keyboard.press("Escape");
    await new Promise(r => setTimeout(r, 500));
  } else {
    console.log("Vehicle type combobox not found");
  }

  // ---- Test 2: click Make input, type "Hyundai", dump what appears ----
  console.log("\n=== TEST: Make autocomplete suggestions ===");
  const makeHandle = await page.evaluateHandle(() => {
    const candidates = Array.from(document.querySelectorAll(
      "input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=search])"
    )) as HTMLElement[];
    for (const el of candidates) {
      let node = el.parentElement;
      for (let d = 0; d < 4 && node; d++) {
        if (node.textContent?.includes("Марка")) return el;
        node = node.parentElement;
      }
    }
    return null;
  });
  const makeEl = makeHandle.asElement();
  if (makeEl) {
    await makeEl.click({ clickCount: 3 });
    await makeEl.type("Hyundai", { delay: 80 });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: "/tmp/fb-make-open.png" });

    const opts = await page.evaluate(() => {
      // Scan many selectors to find what appeared after typing
      const selectors = [
        '[role="option"]',
        '[role="menuitem"]',
        '[role="listitem"]',
        '[role="presentation"]',
        'ul li',
        '[data-value]',
        // FB-specific
        '[class*="autocomplete"] li',
        '[class*="suggest"] div',
      ];
      const results: any[] = [];
      for (const sel of selectors) {
        try {
          const els = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
          const visible = els.filter(e => e.offsetWidth > 0 && e.offsetHeight > 0 && e.textContent?.trim());
          if (visible.length > 0) {
            results.push({
              selector: sel,
              count: visible.length,
              items: visible.slice(0, 5).map(e => ({
                tag: e.tagName,
                role: e.getAttribute("role"),
                text: e.textContent?.trim().slice(0, 60),
                class: e.className?.slice(0, 60),
              })),
            });
          }
        } catch {}
      }
      return results;
    });
    console.log("Make autocomplete results:", JSON.stringify(opts, null, 2));
  } else {
    console.log("Make input not found");
  }

  console.log("\nScreenshots: /tmp/fb-vtype-open.png, /tmp/fb-make-open.png");
  console.log("Close browser to exit.");
  await page.waitForEvent("close", { timeout: 0 }).catch(() => {});
  await context.close();
}

main().catch(e => { console.error(e); process.exit(1); });
