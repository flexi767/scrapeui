import fsp from 'fs/promises';
import path from 'path';
import type { Page } from 'playwright';
import { acceptMobileBgCookies } from '@/lib/mobile-bg/auth';

export interface RepostBackupImage {
  local_path: string;
}

export async function assertMobileBgUploadInputAvailable(
  page: Page,
  repostDir: string,
  phase: string,
): Promise<void> {
  const selector = 'input[type="file"].plupload_html5, .plupload.html5 input[type="file"], input[type="file"]';
  const input = page.locator(selector).first();
  if (await input.count() > 0) return;

  await fsp.mkdir(repostDir, { recursive: true });
  const screenshotPath = path.join(repostDir, `${phase}-missing-upload-input.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);

  const pageText = ((await page.textContent('body').catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  const message = pageText ? ` Mobile.bg page text: ${pageText.slice(0, 500)}` : '';
  throw new Error(`Mobile.bg did not show the image upload step after submitting the listing details.${message}`);
}

export async function uploadMobileBgBackupImages(
  page: Page,
  images: RepostBackupImage[],
  repostDir: string,
  phase: string,
): Promise<void> {
  if (images.length === 0) return;
  await assertMobileBgUploadInputAvailable(page, repostDir, phase);
  const uploadInput = page.locator('input[type="file"].plupload_html5, .plupload.html5 input[type="file"], input[type="file"]').first();
  for (const image of images) {
    const responsePromise = page.waitForResponse((response) => response.url().includes('upload.cgi'), { timeout: 30000 });
    await uploadInput.setInputFiles(image.local_path);
    await responsePromise;
    await page.waitForTimeout(300);
  }
}

export async function continueMobileBgPublish(page: Page): Promise<void> {
  await acceptMobileBgCookies(page);
  const continueButton = page.locator('a.pubButton, a:has-text("ПРОДЪЛЖИ"), input[value="ПРОДЪЛЖИ"]').first();
  if (await continueButton.count() > 0) {
    await continueButton.click({ force: true });
  } else {
    await page.evaluate(() => {
      document.getElementById('cookiescript_injected_wrapper')?.remove();
      document.getElementById('cookiescript_injected')?.remove();
      const steps = (document as Document & { steps?: HTMLFormElement }).steps;
      if (steps) {
        const step = steps.querySelector('[name="step"]') as HTMLInputElement | null;
        const actions = steps.querySelector('[name="actions"]') as HTMLInputElement | null;
        if (step) step.value = '3';
        if (actions) actions.value = '22';
        steps.submit();
      }
    });
  }
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2500);
}

function extractMobileIdFromResult(url: string, bodyText: string): string | null {
  return url.match(/obiava-(\d+)/)?.[1]
    || bodyText.match(/Обява:\s*(\d{15,})/)?.[1]
    || bodyText.match(/showPrintPDF\('?(\d{15,})'?/)?.[1]
    || null;
}

export async function resolvePublishedMobileBgListing(
  page: Page,
  options: { clickViewButton?: boolean } = {},
): Promise<{ resultUrl: string; targetMobileId: string | null }> {
  let resultUrl = page.url();
  let resultText = (await page.textContent('body').catch(() => '')) || '';
  let targetMobileId = extractMobileIdFromResult(resultUrl, resultText);

  if (!targetMobileId) {
    const viewButton = page.locator('a:has-text("Преглед на обявата")').first();
    if (await viewButton.count() > 0) {
      const href = await viewButton.getAttribute('href');
      targetMobileId = href ? href.match(/obiava-(\d+)/)?.[1] || targetMobileId : targetMobileId;
      if (href) {
        resultUrl = href;
      } else if (options.clickViewButton) {
        await acceptMobileBgCookies(page);
        await viewButton.click({ force: true });
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1800);
        resultUrl = page.url();
        resultText = (await page.textContent('body').catch(() => '')) || '';
        targetMobileId = extractMobileIdFromResult(resultUrl, resultText);
      }
    }
  }

  return { resultUrl, targetMobileId };
}

