
import Link from "next/link";
import NewListingForm from "@/components/NewListingForm";
import { fetchMakesModels } from "@/lib/mobile-bg/makes-models";
import { loadMobileBgMakesMapFromDb } from "@/lib/mobile-bg/reference";
import { fetchFuelTypes } from "@/lib/mobile-bg/fuel-types";
import { fetchTransmissionTypes } from "@/lib/mobile-bg/transmission-types";
import { CANONICAL_BODY_TYPES } from "@/lib/mobile-bg/body-types";
import { fetchRegions } from "@/lib/mobile-bg/regions";
import { MOBILE_BG_COLORS } from "@/lib/mobile-bg/colors";
import { raw } from "@/db/client";
import { getListingThumbSrc } from "@/lib/listing-thumb";
import { notDuplicateLExpr } from "@/lib/query-modules/types";

interface DealerRow {
  id: number;
  slug: string;
  name: string;
}
interface DealerListingSummaryRow {
  backup_id: number;
  dealer_id: number;
  mobile_id: string | null;
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
  is_draft: number;
}

function getOwnDealers(): DealerRow[] {
  return raw
    .prepare(
      `SELECT id, slug, name FROM dealers WHERE own = 1 AND active = 1 ORDER BY priority DESC, name`,
    )
    .all() as DealerRow[];
}

function getOwnListingsByDealer(): Record<
  string,
  Array<{
    mobileId: string;
    backupId: number | null;
    make: string;
    model: string;
    title: string;
    price: number | null;
    thumb: string | null;
  }>
> {
  const rows = raw
    .prepare(
      `
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
      b.id as backup_id,
      b.dealer_id,
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
      ) as first_backup_image_id,
      CASE WHEN l.id IS NULL THEN 1 ELSE 0 END as is_draft
    FROM ranked_backups b
    LEFT JOIN listings l ON l.id = b.listing_id
    LEFT JOIN dealers d ON b.dealer_id = d.id
    WHERE b.row_num = 1
      AND d.own = 1 AND d.active = 1
      AND (l.is_active = 1 OR l.id IS NULL)
      AND ${notDuplicateLExpr}
    ORDER BY b.dealer_id, is_draft DESC, l.last_edit DESC, b.id DESC
  `,
    )
    .all() as DealerListingSummaryRow[];

  const byDealer: Record<
    string,
    Array<{
      mobileId: string;
      backupId: number | null;
      make: string;
      model: string;
      title: string;
      price: number | null;
      thumb: string | null;
    }>
  > = {};

  for (const row of rows) {
    const mobileId = row.mobile_id ?? "";
    const thumb = getListingThumbSrc(row);
    const key = String(row.dealer_id);
    if (!byDealer[key]) byDealer[key] = [];
    byDealer[key].push({
      mobileId,
      backupId: row.backup_id,
      make: row.make ?? "",
      model: row.model ?? "",
      title: row.title ?? "",
      price: row.price_amount,
      thumb,
    });
  }

  return byDealer;
}

export default async function NewListingPage() {
  const [makesMap, fuelMap, transmissionMap, regions] = await Promise.all([
    Promise.resolve(loadMobileBgMakesMapFromDb(raw) ?? null)
      .then((map) => map ?? fetchMakesModels())
      .catch(() => null),
    fetchFuelTypes().catch(() => null),
    fetchTransmissionTypes().catch(() => null),
    fetchRegions().catch(() => []),
  ]);

  const makes = makesMap
    ? Array.from(makesMap.values()).sort((a, b) =>
        a.make.localeCompare(b.make, "bg"),
      )
    : [];

  const fuels = fuelMap ? Array.from(fuelMap.values()) : [];

  const transmissions = transmissionMap
    ? Array.from(transmissionMap.values())
    : [];

  const dealers = getOwnDealers();
  const initialDealerId = dealers.find(
    (dealer) => dealer.slug === "carbros",
  )?.id;
  const dealerListingsByDealer = getOwnListingsByDealer();

  return (
    <div className="min-h-screen bg-[#111827]">
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <Link
            href="/editown"
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            ← Own Listings
          </Link>
          <span className="text-sm font-medium text-gray-300">Нова обява</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <NewListingForm
          makes={makes}
          transmissions={transmissions}
          fuels={fuels}
          bodyTypes={[...CANONICAL_BODY_TYPES]}
          regions={regions}
          colors={[...MOBILE_BG_COLORS]}
          dealers={dealers}
          initialDealerId={
            initialDealerId ? String(initialDealerId) : undefined
          }
          initialDealerListingsByDealer={dealerListingsByDealer}
        />
      </main>
    </div>
  );
}
