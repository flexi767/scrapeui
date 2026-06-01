import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { chromium, type BrowserContext, type Page } from "playwright";

// Anchored to the repo root (this file lives at lib/facebook-marketplace/) so
// the saved session path stays stable at <repo>/storage/fb-session.
export const SESSION_DIR =
  process.env.FB_SESSION_DIR ||
  path.resolve(__dirname, "..", "..", "storage", "fb-session");

const HEADLESS = process.env.HEADLESS === "true";
const SLOW_MO = 80;

function ensureSessionDir() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
}

function clearProfileLock(profileDir: string): void {
  try { execSync(`pkill -f ${JSON.stringify(profileDir)} 2>/dev/null || true`); } catch { /* ok */ }
  try { execSync("sleep 0.8"); } catch { /* ok */ }
  const lockFile = path.join(profileDir, "SingletonLock");
  try { fs.unlinkSync(lockFile); } catch { /* not present */ }
}

export async function launchMarketplaceContext(): Promise<{ context: BrowserContext; page: Page }> {
  ensureSessionDir();
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
  const page = existingPages.length > 0 ? existingPages[0] : await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  return { context, page };
}
