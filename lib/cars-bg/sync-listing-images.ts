import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import { CARIMG_DIR } from '@/lib/storage-paths';
import { getCdnImageUrl, parseJson, type ImageMeta } from '@/lib/utils';

const LOCAL_IMAGE_BASE_DIR = CARIMG_DIR;

interface CarsBgSyncImageSourceRow {
  mobile_id: string | null;
  full_keys: string | null;
  image_meta: string | null;
  images_downloaded: number | null;
  latest_backup_id?: number | null;
}

function getBackupOrderedImages(db: Database.Database, backupId: number | null | undefined): string[] {
  if (!backupId) return [];
  const rows = db.prepare(`
    SELECT local_path, source_url
    FROM mobilebg_backup_images
    WHERE backup_id = ?
    ORDER BY sort_order ASC, id ASC
  `).all(backupId) as Array<{ local_path: string | null; source_url: string | null }>;

  return rows
    .map((row) => {
      if (row.local_path && fs.existsSync(row.local_path)) return row.local_path;
      return row.source_url;
    })
    .filter((value): value is string => Boolean(value));
}

export function parseCarsBgSyncListingImageSources(
  db: Database.Database,
  row: CarsBgSyncImageSourceRow,
): string[] {
  const backupOrdered = getBackupOrderedImages(db, row.latest_backup_id);
  if (backupOrdered.length) return backupOrdered;

  const fullKeys = parseJson<string[]>(row.full_keys, []);
  if (!fullKeys.length || !row.mobile_id) return [];

  if (fullKeys[0]?.startsWith('http')) return fullKeys;

  if (row.images_downloaded === 1) {
    const local: string[] = [];
    for (let i = 0; i < fullKeys.length; i++) {
      const filename = `${String(i + 1).padStart(2, '0')}.webp`;
      const filePath = path.join(LOCAL_IMAGE_BASE_DIR, row.mobile_id, 'full', filename);
      if (fs.existsSync(filePath)) local.push(filePath);
    }
    if (local.length) return local;
  }

  const imageMeta = parseJson<ImageMeta | null>(row.image_meta, null);
  if (!imageMeta) return [];
  return fullKeys.map((key) => getCdnImageUrl(row.mobile_id!, key, imageMeta, 'full'));
}
