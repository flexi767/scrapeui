import { raw } from '@/db/client';
import { notDuplicateLExpr, rankedBackupsCte } from '@/lib/query-modules/types';
import { buildImageList, getPreferredListingThumbUrl, parseJson, type ImageMeta } from '@/lib/utils';

export interface OwnSearchRankTarget {
  backup_id: number;
  listing_id: number;
  mobile_id: string | null;
  title: string | null;
  make: string | null;
  model: string | null;
  thumb_url: string | null;
  listing_url: string | null;
}

interface OwnSearchRankTargetRow extends OwnSearchRankTarget {
  thumb_keys: string | null;
  full_keys: string | null;
  image_meta: string | null;
  images_downloaded: number | null;
  thumb_saved: number | null;
  first_backup_image_id: number | null;
}

function getOwnSearchRankTargetRows(missingOnly: boolean) {
  const whereExtras = missingOnly
    ? `AND (
        b.search_checked_at IS NULL
        OR b.search_original_position IS NULL
      )`
    : '';

  return raw.prepare(`
    ${rankedBackupsCte}
    SELECT
      b.id as backup_id,
      l.id as listing_id,
      l.mobile_id,
      COALESCE(b.title, l.title) as title,
      COALESCE(b.make, l.make) as make,
      COALESCE(b.model, l.model) as model,
      l.thumb_keys,
      l.full_keys,
      l.image_meta,
      l.images_downloaded,
      l.thumb_saved,
      (
        SELECT i.id
        FROM mobilebg_backup_images i
        JOIN mobilebg_backups ib ON ib.id = i.backup_id
        WHERE ib.listing_id = l.id
        ORDER BY i.sort_order ASC, i.id ASC
        LIMIT 1
      ) as first_backup_image_id
    FROM ranked_backups b
    JOIN listings l ON l.id = b.listing_id
    JOIN dealers d ON d.id = b.dealer_id
    WHERE
      b.row_num = 1
      AND d.own = 1
      AND d.active = 1
      AND l.is_active = 1
      AND ${notDuplicateLExpr}
      AND l.mobile_id IS NOT NULL
      ${whereExtras}
    ORDER BY d.priority DESC, d.name, COALESCE(b.make, l.make), COALESCE(b.model, l.model), l.mobile_id
  `).all() as OwnSearchRankTargetRow[];
}

function addTargetPreview(targets: OwnSearchRankTargetRow[]): OwnSearchRankTarget[] {
  return targets.map((target) => {
    const thumbKeys = parseJson<string[]>(target.thumb_keys, []);
    const fullKeys = parseJson<string[]>(target.full_keys, []);
    const imageMeta = parseJson<ImageMeta | null>(target.image_meta, null);
    const images = target.mobile_id
      ? buildImageList(
          target.mobile_id,
          fullKeys.length ? fullKeys : thumbKeys,
          thumbKeys,
          imageMeta,
          target.images_downloaded === 1,
        )
      : [];

    return {
      backup_id: target.backup_id,
      listing_id: target.listing_id,
      mobile_id: target.mobile_id,
      title: target.title,
      make: target.make,
      model: target.model,
      thumb_url: target.first_backup_image_id
        ? `/api/mobilebg-backup-images/${target.first_backup_image_id}`
        : getPreferredListingThumbUrl(target.mobile_id, images[0]?.thumb, target.thumb_saved),
      listing_url: target.mobile_id ? `/listings/${target.mobile_id}` : null,
    };
  });
}

export function getOwnSearchRankTargets(missingOnly: boolean) {
  return addTargetPreview(getOwnSearchRankTargetRows(missingOnly));
}

