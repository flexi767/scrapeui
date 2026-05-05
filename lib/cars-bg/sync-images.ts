import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import type { Page } from 'playwright';
import { USER_AGENT } from '@/lib/mobile-bg/constants';

export const MAX_PHOTO_UPLOADS = 15;

let sharpModule: typeof import('sharp') | null | undefined;

async function getSharp() {
  if (sharpModule !== undefined) return sharpModule;
  try {
    const sharpImport = await import('sharp');
    sharpModule = ('default' in sharpImport ? sharpImport.default : sharpImport) as typeof import('sharp');
  } catch {
    sharpModule = null;
  }
  return sharpModule;
}

async function convertToJpeg(filePath: string): Promise<string | null> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return filePath;
  const sharp = await getSharp();
  if (!sharp) return null;
  const jpegPath = filePath.replace(/\.[^.]+$/, '.jpg');
  await sharp(filePath).jpeg({ quality: 90 }).toFile(jpegPath);
  return jpegPath;
}

export async function downloadImages(urls: string[], prefix: string): Promise<{ dir: string; files: string[] }> {
  const fsp = fs.promises;
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), `cars-bg-${prefix || randomUUID()}-`));
  const files: string[] = [];
  const seen = new Set<string>();
  const uniqueUrls = urls.filter((url) => {
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });

  for (let i = 0; i < uniqueUrls.length && files.length < MAX_PHOTO_UPLOADS; i++) {
    const url = uniqueUrls[i];
    try {
      if (url.startsWith('/')) {
        if (!fs.existsSync(url)) continue;
        const ext = path.extname(url) || '.webp';
        const target = path.join(dir, `${i}${ext}`);
        await fsp.copyFile(url, target);
        files.push(target);
        continue;
      }

      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      const ext = path.extname(new URL(url).pathname) || '.jpg';
      const target = path.join(dir, `${i}${ext}`);
      await fsp.writeFile(target, buffer);
      files.push(target);
    } catch {
      continue;
    }
  }

  return { dir, files };
}

async function uploadImagesFallback(page: Page, files: string[]): Promise<void> {
  const initialCount = await page.evaluate(() => document.querySelectorAll('.photobox.haspic').length).catch(() => 0);
  for (let i = 0; i < files.length; i++) {
    const input = await page.$(`#uploadFile${i + 1}`).catch(() => null);
    if (!input) break;
    await input.setInputFiles([files[i]]);
    await page.evaluate((index) => {
      const el = document.getElementById(`uploadFile${index}`);
      if (el) el.dispatchEvent(new Event('change', { bubbles: true }));
    }, i + 1);
    const ok = await page.waitForFunction(
      (expected) => document.querySelectorAll('.photobox.haspic').length >= expected,
      initialCount + i + 1,
      { timeout: 15000 },
    ).then(() => true).catch(() => false);
    void ok;
    await page.waitForTimeout(600);
  }
}

export async function uploadImages(page: Page, files: string[]): Promise<void> {
  const uploadCount = Math.min(files.length, MAX_PHOTO_UPLOADS);
  if (uploadCount === 0) return;

  const jpegFiles: string[] = [];
  for (const file of files.slice(0, uploadCount)) {
    const converted = await convertToJpeg(file).catch(() => null);
    if (converted) jpegFiles.push(converted);
  }
  if (jpegFiles.length === 0) return;

  const currentUrl = page.url();
  const offerIdMatch = currentUrl.match(/objectId=([a-f0-9]{24})/i);
  const offerId = offerIdMatch ? offerIdMatch[1] : '0';
  const uploadReady = await page.evaluate(() => typeof (window as Window & { UploadFiles?: unknown }).UploadFiles === 'function').catch(() => false);
  if (!uploadReady) {
    await uploadImagesFallback(page, jpegFiles);
    return;
  }

  const fsp = fs.promises;
  for (const filePath of jpegFiles) {
    const fileBytes = await fsp.readFile(filePath);
    const base64 = fileBytes.toString('base64');
    const slotId = await page.evaluate(() => {
      const empty = document.querySelector('.photobox:not(.haspic)');
      if (!empty) return null;
      try {
        const args = empty.getAttribute('data-action-args');
        return args ? JSON.parse(args).fileId : null;
      } catch {
        return null;
      }
    });
    if (slotId == null) break;

    await page.evaluate(async ({ base64Data, slot, currentOfferId }) => {
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'image/jpeg' });
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });

      await new Promise<void>((resolve) => {
        const upload = (window as Window & { UploadFiles?: (slotId: number, file: File, files: File[], offerId: string) => void }).UploadFiles;
        if (typeof upload !== 'function') {
          resolve();
          return;
        }
        const observer = new MutationObserver(() => {
          if (document.querySelector(`#photobox_${slot}.haspic`)) {
            observer.disconnect();
            resolve();
          }
        });
        observer.observe(document.getElementById(`photobox_${slot}`) || document.body, {
          attributes: true,
          attributeFilter: ['class'],
          subtree: true,
        });
        setTimeout(() => {
          observer.disconnect();
          resolve();
        }, 20000);
        upload(slot, file, [file], currentOfferId);
      });
    }, { base64Data: base64, slot: slotId, currentOfferId: offerId });

    await page.waitForTimeout(500);
  }
}
