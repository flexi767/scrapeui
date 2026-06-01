import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { acceptMobileBgCookies, loginMobileBg } from '@/lib/mobile-bg/auth';
import { DealerBackupConfig, USER_AGENT } from '@/lib/mobile-bg/constants';

export interface MobileBgUpdateSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  dealerSlug: string;
}

export function normalizePromoStatus(value: string | null | undefined): 'TOP' | 'VIP' | 'none' {
  const normalized = (value || '').trim().toUpperCase();
  if (normalized === 'TOP' || normalized === 'BEST') return 'TOP';
  if (normalized === 'VIP') return 'VIP';
  return 'none';
}

async function gotoMyAds(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto('https://www.mobile.bg/pcgi/mobile.cgi?act=6&subact=4&actions=23', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      await acceptMobileBgCookies(page);
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout(1000);
    }
  }
}

export async function createMobileBgUpdateSession(
  dealer: DealerBackupConfig,
  log: (message: string) => void = () => {},
): Promise<MobileBgUpdateSession> {
  log('Launching browser session…');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  try {
    log(`Logging into mobile.bg as ${dealer.slug}…`);
    if (!await loginMobileBg(page, dealer.mobileUser, dealer.mobilePassword)) {
      throw new Error(`Login failed for ${dealer.slug}`);
    }

    return {
      browser,
      context,
      page,
      dealerSlug: dealer.slug,
    };
  } catch (error) {
    await browser.close().catch(() => {});
    throw error;
  }
}

export async function closeMobileBgUpdateSession(session: MobileBgUpdateSession): Promise<void> {
  await session.browser.close();
}

async function readMyAdsPromoState(
  page: Page,
  mobileId: string,
): Promise<{ status: 'TOP' | 'VIP' | 'none'; vipDisabled: boolean }> {
  return page.evaluate((targetId) => {
    const statusText = document.querySelector(`#status_info_${targetId}`)?.textContent || '';
    const vipButton = document.querySelector(`#make_vip_${targetId}`) as HTMLElement | null;
    const vipDisabled = vipButton?.classList.contains('disabled') || false;
    const normalized = /ТОП|BEST/i.test(statusText)
      ? 'TOP'
      : /VIP/i.test(statusText)
      ? 'VIP'
      : 'none';
    return { status: normalized, vipDisabled };
  }, mobileId);
}

export async function promoteListingStatusOnMyAds(
  page: Page,
  mobileId: string,
  desiredStatus: 'TOP' | 'VIP' | 'none',
  log: (message: string) => void,
): Promise<'TOP' | 'VIP' | 'none'> {
  await gotoMyAds(page);

  const current = await readMyAdsPromoState(page, mobileId);
  if (desiredStatus === 'none') {
    if (current.status !== 'none') {
      log(`Listing #${mobileId} is already ${current.status}. mobile.bg does not allow downgrading paid status during the active period.`);
    }
    return current.status;
  }

  if (current.status === desiredStatus) {
    log(`Listing #${mobileId} is already ${desiredStatus}.`);
    return current.status;
  }

  if (desiredStatus === 'VIP' && (current.status === 'TOP' || current.vipDisabled)) {
    log(`Listing #${mobileId} is already TOP/BEST, so mobile.bg will not allow a VIP change.`);
    return 'TOP';
  }

  const triggerSelector = desiredStatus === 'TOP'
    ? `#make_top_${mobileId}`
    : `#make_vip_${mobileId}`;

  log(`Applying ${desiredStatus} status for one week on mobile.bg…`);
  await page.click(triggerSelector, { force: true });
  await page.waitForTimeout(600);

  const promoSelect = page.locator('#sidebar-promotirane-select');
  if (await promoSelect.count() > 0) {
    const optionValues = await promoSelect.locator('option').evaluateAll((options) =>
      options.map((option) => ({
        value: (option as HTMLOptionElement).value,
        text: option.textContent?.trim() || '',
      })),
    ).catch(() => []);

    const statusPattern = desiredStatus === 'TOP'
      ? /ТОП|TOP|BEST/i
      : /VIP/i;
    const weekOption =
      optionValues.find((option) => statusPattern.test(option.text) && /1\s*седмиц|една\s*седмиц|1\s*week/i.test(option.text)) ||
      optionValues.find((option) => statusPattern.test(option.text)) ||
      optionValues.find((option) => /1\s*седмиц|една\s*седмиц|1\s*week/i.test(option.text)) ||
      optionValues[0];

    if (weekOption?.value) {
      await promoSelect.selectOption(weekOption.value).catch(() => {});
      await page.waitForTimeout(200);
    }
  }

  await page.click('#vip-confirm-btn', { force: true });
  await page.waitForTimeout(600);

  const popupConfirm = page.locator('#popup-lite-vip-confirm-btn');
  if (await popupConfirm.count() > 0) {
    const popupVisible = await popupConfirm.evaluate((element) => {
      const popup = element.closest('.popup-lite') as HTMLElement | null;
      if (!popup) return false;
      const style = window.getComputedStyle(popup);
      return style.display !== 'none' && style.visibility !== 'hidden';
    }).catch(() => false);

    if (popupVisible) {
      await popupConfirm.click({ force: true });
      await page.waitForTimeout(800);
    }
  }

  await page.waitForFunction(
    ({ targetId, targetStatus }) => {
      const text = document.querySelector(`#status_info_${targetId}`)?.textContent || '';
      if (targetStatus === 'TOP') return /ТОП|BEST/i.test(text);
      if (targetStatus === 'VIP') return /VIP/i.test(text);
      return !/ТОП|BEST|VIP/i.test(text);
    },
    { targetId: mobileId, targetStatus: desiredStatus },
    { timeout: 20000 },
  ).catch(() => {});

  const finalState = await readMyAdsPromoState(page, mobileId);
  log(`mobile.bg paid status is now ${finalState.status}.`);
  return finalState.status;
}

