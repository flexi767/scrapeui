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

  // Select "Автомобил/камион" vehicle type first so other fields appear
  const vtEls = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('label[role="combobox"]')) as HTMLElement[];
    const vt = els.find(e => e.textContent?.includes("Тип превозно средство"));
    if (vt) { vt.click(); return true; }
    return false;
  });
  if (vtEls) {
    await new Promise(r => setTimeout(r, 1000));
    await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll('[role="option"]')) as HTMLElement[];
      const auto = opts.find(e => e.textContent?.trim() === "Автомобил/камион");
      if (auto) auto.click();
    });
    await new Promise(r => setTimeout(r, 500));
    // Close dropdown by clicking heading
    await page.locator('h1, h2, [role="heading"]').first().click({ force: true }).catch(() =>
      page.mouse.click(640, 40)
    );
    await new Promise(r => setTimeout(r, 1500));
    console.log("  ✓ Selected Автомобил/камион, dumping fields after selection...");
  }

  // ---- Dump all label[role=combobox] with surrounding label text ----
  console.log("\n=== All label comboboxes ===");
  const comboboxes = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('label[role="combobox"]')) as HTMLElement[];
    return els.map(el => {
      let node = el.parentElement;
      const texts: string[] = [];
      for (let d = 0; d < 6 && node; d++) {
        const direct = Array.from(node.childNodes)
          .filter(n => n.nodeType === Node.TEXT_NODE || (n as HTMLElement).tagName === 'SPAN')
          .map(n => n.textContent?.trim()).filter(Boolean);
        if (direct.length) texts.push(...(direct as string[]));
        node = node.parentElement;
      }
      return {
        ariaLabel: el.getAttribute('aria-label'),
        innerText: el.textContent?.trim().slice(0, 60),
        surroundingText: [...new Set(texts)].slice(0, 8),
      };
    });
  });
  console.log(JSON.stringify(comboboxes, null, 2));

  // ---- Dump all visible text inputs with their labels ----
  console.log("\n=== All visible text inputs ===");
  const inputs = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll(
      "input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]):not([type=search]), textarea"
    )) as HTMLElement[];
    return els
      .filter(e => (e as HTMLInputElement).offsetWidth > 0)
      .map(el => {
        let node = el.parentElement;
        const texts: string[] = [];
        for (let d = 0; d < 5 && node; d++) {
          const direct = Array.from(node.childNodes)
            .filter(n => n.nodeType === Node.TEXT_NODE || (n as HTMLElement).tagName === 'SPAN' || (n as HTMLElement).tagName === 'LABEL')
            .map(n => n.textContent?.trim()).filter(Boolean);
          if (direct.length) texts.push(...(direct as string[]));
          node = node.parentElement;
        }
        return {
          tag: el.tagName,
          type: (el as HTMLInputElement).type,
          placeholder: (el as HTMLInputElement).placeholder,
          ariaLabel: el.getAttribute('aria-label'),
          value: (el as HTMLInputElement).value?.slice(0, 40),
          surroundingText: [...new Set(texts)].slice(0, 6),
        };
      });
  });
  console.log(JSON.stringify(inputs, null, 2));

  // ---- Dump all checkboxes ----
  console.log("\n=== All checkboxes ===");
  const checkboxes = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('input[type=checkbox], [role=checkbox], [role=switch]')) as HTMLElement[];
    return els.filter(e => e.offsetWidth > 0).map(el => {
      let node = el.parentElement;
      const texts: string[] = [];
      for (let d = 0; d < 5 && node; d++) {
        const t = node.textContent?.trim().slice(0, 80);
        if (t) texts.push(t);
        node = node.parentElement;
      }
      return {
        role: el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label'),
        ariaChecked: el.getAttribute('aria-checked'),
        checked: (el as HTMLInputElement).checked,
        surroundingText: [...new Set(texts)].slice(0, 3),
      };
    });
  });
  console.log(JSON.stringify(checkboxes, null, 2));

  await page.screenshot({ path: "/tmp/fb-inspect.png" });
  console.log("\nScreenshot: /tmp/fb-inspect.png");
  console.log("Close browser to exit.");
  await page.waitForEvent("close", { timeout: 0 }).catch(() => {});
  await context.close();
}

main().catch(e => { console.error(e); process.exit(1); });
