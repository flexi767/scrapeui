import type Database from 'better-sqlite3';
import { chromium } from 'playwright';
import { loginMobileBg } from '@/lib/mobile-bg/auth';
import { USER_AGENT } from '@/lib/mobile-bg/constants';
import type { DealerBackupConfig } from '@/lib/mobile-bg/backup';
import { captureEditFormSnapshotWithPage } from '@/lib/mobile-bg/edit-form-capture';

export { captureEditFormSnapshotWithPage };

export async function captureEditFormSnapshot(
  db: Database.Database,
  dealer: DealerBackupConfig,
  mobileId: string,
  dbPath: string,
): Promise<{ snapshotId: number; screenshotPath: string | null }> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  try {
    if (!await loginMobileBg(page, dealer.mobileUser, dealer.mobilePassword)) {
      throw new Error(`Login failed for ${dealer.slug}`);
    }
    return await captureEditFormSnapshotWithPage(db, dealer, mobileId, dbPath, page);
  } finally {
    await browser.close();
  }
}
