import { NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { getListingThumbSrc } from '@/lib/listing-thumb';
import { latestBackupOrderExpr, rankedBackupsCte } from '@/lib/query-modules/types';

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
  const dealerId = Number((await params).dealerId);
  if (!Number.isInteger(dealerId) || dealerId <= 0) {
    return NextResponse.json({ error: 'Invalid dealer ID' }, { status: 400 });
  }

  const rows = raw.prepare(`
    ${rankedBackupsCte}
    SELECT
      l.mobile_id,
      COALESCE(b.make, l.make) as make,
      COALESCE(b.model, l.model) as model,
      COALESCE(b.title, l.title) as title,
      COALESCE(b.price_amount, l.current_price) as price_amount,
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

  const listings = rows.map((row) => ({
    mobileId: row.mobile_id,
    make: row.make ?? '',
    model: row.model ?? '',
    title: row.title ?? '',
    price: row.price_amount,
    thumb: getListingThumbSrc(row),
  }));

  return NextResponse.json({ listings });
}
