import type { Locator, Page } from 'playwright';

const CARS_BG_SUBMIT_SELECTORS = [
  '#publishBtn',
  'button[type="submit"]',
  'input[type="submit"]',
  'a.btn-thick',
  'button:has-text("Запази")',
  'button:has-text("Промени")',
];

export async function submitCarsBgForm(page: Page): Promise<void> {
  for (const selector of CARS_BG_SUBMIT_SELECTORS) {
    const button = page.locator(selector).first();
    if (await button.count()) {
      await button.click().catch(() => {});
      await waitForCarsBgSubmit(page);
      return;
    }
  }

  await page.locator('form').first().evaluate((form) => (form as HTMLFormElement).submit()).catch(() => {});
  await waitForCarsBgSubmit(page);
}

export async function waitForCarsBgSubmit(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
}

export async function readCarsBgFormErrors(page: Page): Promise<string> {
  return page
    .$$eval('.error', (nodes) => nodes.map((node) => node.textContent?.trim()).filter(Boolean).join(' | '))
    .catch(() => '');
}

export async function firstLocatorValue(locator: Locator): Promise<string> {
  return locator.inputValue().catch(() => '');
}

