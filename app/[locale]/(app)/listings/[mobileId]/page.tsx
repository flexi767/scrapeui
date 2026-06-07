
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import EmblaCarousel from '@/components/EmblaCarousel';
import { AdStatusBadge } from '@/components/listings/AdStatusBadge';
import { KaparoBadge, VatBadge } from '@/components/listings/VatBadge';
import { getListingByMobileId, getSnapshots } from '@/lib/queries';
import { buildImageList, formatCount, formatDate, formatMileage, formatPrice, parseJson } from '@/lib/utils';
import { getPriceWithVat } from '@/lib/vat';

interface Props {
  params: Promise<{ mobileId: string }>;
}

function SpecRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex justify-between gap-4 border-b border-gray-700/50 py-2 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-right font-medium text-gray-100">{String(value)}</span>
    </div>
  );
}

export default async function ListingDetailPage({ params }: Props) {
  const t = await getTranslations('ui');
  const { mobileId } = await params;
  const listing = getListingByMobileId(mobileId);
  if (!listing) notFound();

  const snapshots = getSnapshots(listing.id);
  const lastPriceSnapshot = [...snapshots].reverse().find((s): s is typeof s & { price: number } => s.price != null);

  const imageMeta = parseJson<{ cdn: string; shard: string } | null>(
    listing.image_meta,
    null,
  );
  const fullKeys = parseJson<string[]>(listing.full_keys, []);
  const thumbKeys = parseJson<string[]>(listing.thumb_keys, []);

  const images = buildImageList(
    listing.mobile_id,
    fullKeys,
    thumbKeys,
    imageMeta,
    listing.images_downloaded === 1,
  );

  const regDisplay =
    listing.reg_month && listing.reg_year
      ? `${listing.reg_month}/${listing.reg_year}`
      : listing.reg_year ?? '—';

  return (
    <div className="min-h-screen bg-[#111827]">
      {/* Nav bar */}
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-3">
          <Link href="/listings" className="text-sm text-gray-400 hover:text-white">
            {t('all_listings_back')}
          </Link>
          <span className="text-gray-600">/</span>
          <span className="truncate text-sm text-gray-300">{listing.title}</span>
          {listing.source === 'c' && (
            <span className="rounded bg-purple-900/70 px-1.5 py-0.5 text-[10px] text-purple-200">cars.bg</span>
          )}
          {!listing.is_active && (
            <span className="ml-2 rounded-full bg-red-900/60 px-2 py-0.5 text-[11px] text-red-300">
              {t('inactive')}
            </span>
          )}
          <Link href="/config" className="ml-auto text-sm text-gray-400 hover:text-gray-200 transition-colors">{t('config_link')}</Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: images + description */}
          <div className="lg:col-span-2 space-y-6">
            <EmblaCarousel images={images} title={listing.title} />

            {/* Description */}
            {listing.description && (
              <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
                  {t('description')}
                </h2>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-300">
                  {listing.description}
                </pre>
              </div>
            )}
          </div>

          {/* Right: details */}
          <div className="space-y-4">
            {/* Price card */}
            <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
              <div className="mb-1 flex items-center gap-2 flex-wrap">
                <span className="text-3xl font-bold text-green-400">
                  {formatPrice(listing.current_price)}
                </span>
                {getPriceWithVat(listing.current_price, listing.vat) != null && (
                  <span className="text-lg font-semibold text-emerald-200">
                    {formatPrice(getPriceWithVat(listing.current_price, listing.vat))}
                  </span>
                )}
                <VatBadge vat={listing.vat} />
                <AdStatusBadge
                  status={listing.ad_status}
                  empty="none"
                  className="text-xs"
                />
                <KaparoBadge kaparo={listing.kaparo} label="капаро" empty="none" />
              </div>
              {lastPriceSnapshot && lastPriceSnapshot.price !== listing.current_price && (
                <div className="mt-1 flex items-center gap-2 text-sm">
                  <span className={listing.current_price < lastPriceSnapshot.price ? 'text-green-400' : 'text-red-400'}>
                    {listing.current_price < lastPriceSnapshot.price ? '↘' : '↗'}
                  </span>
                  <span className="text-gray-500 line-through">{formatPrice(lastPriceSnapshot.price)}</span>
                  <span className="text-xs text-gray-500">{formatDate(lastPriceSnapshot.recorded_at)}</span>
                </div>
              )}

              {/* History link */}
              {snapshots.length > 0 && (
                <Link
                  href={`/listings/${listing.mobile_id || listing.cars_id}/history`}
                  className="mt-3 block text-xs text-blue-400 hover:text-blue-300 hover:underline"
                >
                  View history ({snapshots.length} snapshots) →
                </Link>
              )}

              {/* External link */}
              {listing.url && (
                <a
                  href={listing.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block text-xs text-gray-400 hover:text-white"
                >
                  View on {listing.source === 'c' ? 'cars.bg' : 'mobile.bg'} ↗
                </a>
              )}
            </div>

            {/* Dealer */}
            <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
                {t('dealer')}
              </h2>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-100">
                  {listing.dealer_name ?? '—'}
                </span>
                {Boolean(listing.dealer_own) && (
                  <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] text-emerald-100">
                    {t('own')}
                  </span>
                )}
              </div>
              {listing.dealer_url && (
                <a
                  href={listing.dealer_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block text-xs text-gray-500 hover:text-gray-300"
                >
                  {listing.dealer_url}
                </a>
              )}
            </div>

            {/* Specs */}
            <div className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
                {t('specs')}
              </h2>
              <SpecRow label={t('make')} value={listing.make} />
              <SpecRow label={t('model')} value={listing.model} />
              <SpecRow label={t('year')} value={regDisplay} />
              <SpecRow label={t('fuel')} value={listing.fuel} />
              <SpecRow label={t('color')} value={listing.color} />
              <SpecRow
                label={t('power')}
                value={listing.power ? `${listing.power} hp` : null}
              />
              <SpecRow label={t('mileage')} value={formatMileage(listing.mileage)} />
              <SpecRow
                label={t('views')}
                value={formatCount(listing.views)}
              />
              <SpecRow label={t('last_edit')} value={formatDate(listing.last_edit)} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
