import { NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { requireDealerScope } from '@/lib/api/auth-helpers';
import { buildImageList, getThumbProxyUrl, parseJson, type ImageMeta } from '@/lib/utils';
import { ownEditableSelectExprs, rankedBackupsCte } from '@/lib/query-modules/types';
import { parsePositiveIntParam } from '@/lib/api/db-helpers';

interface DealerListingSummaryRow {
  mobile_id: string;
  make: string | null;
  model: string | null;
  title: string | null;
  price_amount: number | null;
  thumb_keys: string | null;
  full_keys: string | null;
  image_meta: string | null;
  images_downloaded: number | null;
  thumb_saved: number | null;
  first_backup_image_id: number | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dealerId: string }> },
) {
  const dealerId = parsePositiveIntParam((await params).dealerId);
  if (!dealerId) {
    return NextResponse.json({ error: 'Invalid dealer ID' }, { status: 400 });
  }

  const check = await requireDealerScope(dealerId);
  if ('error' in check) return check.error;

  const rows = raw.prepare(`
    ${rankedBackupsCte}
    SELECT
      l.mobile_id,
      ${ownEditableSelectExprs.make} as make,
      ${ownEditableSelectExprs.model} as model,
      ${ownEditableSelectExprs.title} as title,
      ${ownEditableSelectExprs.price} as price_amount,
      l.thumb_keys,
      l.full_keys,
      l.image_meta,
      l.images_downloaded,
      l.thumb_saved,
      (
        SELECT i.id
        FROM mobilebg_backup_images i
        WHERE i.backup_id = b.id
        ORDER BY i.sort_order ASC, i.id ASC
        LIMIT 1
      ) as first_backup_image_id
    FROM listings l
    LEFT JOIN ranked_backups b
      ON b.listing_id = l.id
      AND b.row_num = 1
    WHERE l.dealer_id = ?
      AND COALESCE(l.is_active, 1) = 1
      AND COALESCE(l.source, 'm') = 'm'
    ORDER BY l.last_edit DESC, l.id DESC
  `).all(dealerId) as DealerListingSummaryRow[];

  const listings = rows.map((row) => {
    const imageMeta = parseJson<ImageMeta | null>(row.image_meta, null);
    const thumbKeys = parseJson<string[]>(row.thumb_keys, []);
    const fullKeys = parseJson<string[]>(row.full_keys, []);
    const images = buildImageList(
      row.mobile_id,
      fullKeys.length ? fullKeys : thumbKeys,
      thumbKeys,
      imageMeta,
      row.images_downloaded === 1,
    );
    const thumb = row.first_backup_image_id
      ? `/api/mobilebg-backup-images/${row.first_backup_image_id}`
      : getThumbProxyUrl(
          row.mobile_id,
          images[0]?.thumb ?? null,
        );

    return {
      mobileId: row.mobile_id,
      make: row.make ?? '',
      model: row.model ?? '',
      title: row.title ?? '',
      price: row.price_amount,
      thumb,
    };
  });

  return NextResponse.json({ listings });
}
