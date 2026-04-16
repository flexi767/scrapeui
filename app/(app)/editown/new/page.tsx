import Link from 'next/link';
import NewListingForm from '@/components/NewListingForm';
import { fetchMakesModels } from '@/lib/mobile-bg/makes-models';
import { fetchFuelTypes } from '@/lib/mobile-bg/fuel-types';
import { fetchTransmissionTypes } from '@/lib/mobile-bg/transmission-types';
import { CANONICAL_BODY_TYPES } from '@/lib/mobile-bg/body-types';
import { fetchRegions } from '@/lib/mobile-bg/regions';
import { MOBILE_BG_COLORS } from '@/lib/mobile-bg/colors';
import { raw } from '@/db/client';
import { buildImageList, getThumbProxyUrl, parseJson, type ImageMeta } from '@/lib/utils';

interface DealerRow { id: number; slug: string; name: string; }
interface DealerListingSummaryRow {
  dealer_id: number;
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
}

function getOwnDealers(): DealerRow[] {
  return raw.prepare(
    `SELECT id, slug, name FROM dealers WHERE own = 1 AND active = 1 ORDER BY priority DESC, name`
  ).all() as DealerRow[];
}

function getDealerListingsByDealer(): Record<string, Array<{
  mobileId: string;
  make: string;
  model: string;
  title: string;
  price: number | null;
  thumb: string | null;
}>> {
  const rows = raw.prepare(`
    WITH ranked_backups AS (
      SELECT
        b.*,
        ROW_NUMBER() OVER (
          PARTITION BY b.dealer_id, b.mobile_id
          ORDER BY COALESCE(b.updated_at, b.created_at) DESC, b.id DESC
        ) as row_num
      FROM mobilebg_backups b
    )
    SELECT
      l.dealer_id,
      l.mobile_id,
      COALESCE(b.make, l.make) as make,
      COALESCE(b.model, l.model) as model,
      COALESCE(b.title, l.title) as title,
      COALESCE(b.price_amount, l.current_price) as price_amount,
      l.thumb_keys,
      l.full_keys,
      l.image_meta,
      l.images_downloaded,
      l.thumb_saved
    FROM listings l
    LEFT JOIN ranked_backups b
      ON b.listing_id = l.id
      AND b.row_num = 1
    WHERE COALESCE(l.is_active, 1) = 1
      AND COALESCE(l.source, 'm') = 'm'
      AND l.dealer_id IN (SELECT id FROM dealers WHERE own = 1 AND active = 1)
    ORDER BY l.dealer_id, l.last_edit DESC, l.id DESC
  `).all() as DealerListingSummaryRow[];

  const byDealer: Record<string, Array<{
    mobileId: string;
    make: string;
    model: string;
    title: string;
    price: number | null;
    thumb: string | null;
  }>> = {};

  for (const row of rows) {
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
    const thumb = getThumbProxyUrl(row.mobile_id, images[0]?.thumb ?? null);
    const key = String(row.dealer_id);
    if (!byDealer[key]) byDealer[key] = [];
    byDealer[key].push({
      mobileId: row.mobile_id,
      make: row.make ?? '',
      model: row.model ?? '',
      title: row.title ?? '',
      price: row.price_amount,
      thumb,
    });
  }

  return byDealer;
}

export default async function NewListingPage() {
  const [makesMap, fuelMap, transmissionMap, regions] = await Promise.all([
    fetchMakesModels().catch(() => null),
    fetchFuelTypes().catch(() => null),
    fetchTransmissionTypes().catch(() => null),
    fetchRegions().catch(() => []),
  ]);

  const makes = makesMap
    ? Array.from(makesMap.values()).sort((a, b) => a.make.localeCompare(b.make, 'bg'))
    : [];

  const fuels = fuelMap
    ? Array.from(fuelMap.values())
    : [];

  const transmissions = transmissionMap
    ? Array.from(transmissionMap.values())
    : [];

  const dealers = getOwnDealers();
  const dealerListingsByDealer = getDealerListingsByDealer();

  return (
    <div className="min-h-screen bg-[#111827]">
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <Link href="/editown" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
            ← Own Listings
          </Link>
          <span className="text-sm font-medium text-gray-300">Нова обява</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <NewListingForm
          makes={makes}
          fuels={fuels}
          transmissions={transmissions}
          bodyTypes={[...CANONICAL_BODY_TYPES]}
          regions={regions}
          colors={[...MOBILE_BG_COLORS]}
          dealers={dealers}
          initialDealerListingsByDealer={dealerListingsByDealer}
        />
      </main>
    </div>
  );
}
