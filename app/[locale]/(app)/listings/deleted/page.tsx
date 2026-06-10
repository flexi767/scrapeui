
import Link from 'next/link';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { ListingThumbPreview } from '@/components/ListingThumbPreview';
import ListingSearchPrefillButton from '@/components/ListingSearchPrefillButton';
import { AdStatusBadge } from '@/components/listings/AdStatusBadge';
import { ListingPriceCell } from '@/components/listings/ListingPriceCell';
import { SortLink } from '@/components/listings/SortLink';
import { KaparoBadge, VatBadge } from '@/components/listings/VatBadge';
import { ListingsPagination } from '@/components/listings/ListingsPagination';
import FilterBar from '@/components/FilterBar';
import { getAllDealers, getDeletedListings, getDistinctCategories, getDistinctFuels, getDistinctYears, getMakeModels, getPriceRanges } from '@/lib/queries';
import { getListingThumbAlt, getListingThumbSrcFromParts } from '@/lib/listing-thumb';
import {
  buildListingParams,
  LISTING_EXTRA_OPTIONS,
  parseOptionalNum,
  toParamArray,
} from '@/lib/listing-url';
import { formatCount, formatDate } from '@/lib/utils';

interface SearchParams {
  make?: string;
  model?: string;
  dealer?: string | string[];
  year?: string | string[];
  category?: string | string[];
  status?: string | string[];
  vat?: string | string[];
  fuel?: string | string[];
  extra?: string | string[];
  kaparo?: string;
  p_min?: string;
  p_max?: string;
  pc_min?: string;
  pc_max?: string;
  sort?: string;
  order?: string;
  search?: string;
  page?: string;
  cursor?: string;
}

const BASE_PATH = '/listings/deleted';

export default async function DeletedListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const t = await getTranslations('ui');
  const sp = await searchParams;
  const make = sp.make ?? '';
  const model = sp.model ?? '';
  const dealerSlugs = toParamArray(sp.dealer);
  const years = toParamArray(sp.year);
  const categories = toParamArray(sp.category);
  const statuses = toParamArray(sp.status);
  const vatValues = toParamArray(sp.vat);
  const fuels = toParamArray(sp.fuel);
  const extras = toParamArray(sp.extra);
  const priceMin = parseOptionalNum(sp.p_min);
  const priceMax = parseOptionalNum(sp.p_max);
  const priceChangeMin = parseOptionalNum(sp.pc_min);
  const priceChangeMax = parseOptionalNum(sp.pc_max);
  const kaparo = sp.kaparo ?? '';
  const sort = sp.sort ?? 'last_edit';
  const order = sp.order ?? 'desc';
  const search = sp.search ?? '';
  const page = parseInt(sp.page ?? '1', 10);
  const cursor = sp.cursor ?? '';

  const { data: rows, total, nextCursor } = getDeletedListings({
    make, model, dealerSlugs, years, categories, statuses, vatValues, fuels,
    extras, priceMin, priceMax, priceChangeMin, priceChangeMax, kaparo, sort, order, search, page, cursor, limit: 50,
  });

  const makeModels = getMakeModels();
  const allDealers = getAllDealers();
  const makes = Object.keys(makeModels).sort();
  const { priceRange, priceChangeRange } = getPriceRanges();
  const currentParams = buildListingParams({
    statuses,
    vatValues,
    categories,
    fuels,
    extras,
    kaparo,
    make,
    model,
    dealerSlugs,
    years,
    search,
    sort,
    order,
  });

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="min-h-screen bg-[#111827]">
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-[1600px] px-4 py-2">
          <Suspense>
            <FilterBar
              makes={makes}
              makeModels={makeModels}
              allDealers={allDealers}
              allYears={getDistinctYears()}
              allCategories={getDistinctCategories()}
              allFuels={getDistinctFuels()}
              allExtras={LISTING_EXTRA_OPTIONS}
              total={total}
              priceChangeRange={priceChangeRange}
              priceRange={priceRange}
              basePath={BASE_PATH}
              showPageLinks={false}
            />
          </Suspense>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-2">
        <div className="overflow-x-auto rounded-lg border border-gray-700/60">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/60 text-xs font-medium uppercase tracking-wider text-gray-400">
                <th className="w-24 px-3 py-1.5 text-left">{t('img')}</th>
                <th className="px-3 py-1.5 text-left">{t('make_/_model')}</th>
                <th className="px-3 py-1.5 text-left">{t('title')}</th>
                <th className="px-3 py-1.5 text-left"><SortLink label={t('dealer')} sortKey="dealer" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} /></th>
                <th className="px-2 py-1.5 text-center w-14"><SortLink label={t('paid')} sortKey="ad_status" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} /></th>
                <th className="pl-1 pr-3 py-1.5 text-right"><SortLink label={t('price')} sortKey="price" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} /></th>
                <th className="px-3 py-1.5 text-center">{t('vat')}</th>
                <th className="px-2 py-1.5 text-center w-14"><SortLink label={t('к')} sortKey="kaparo" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} /></th>
                <th className="px-3 py-1.5 text-right">{t('views')}</th>
                <th className="px-3 py-1.5 text-right"><SortLink label={t('last_edit')} sortKey="last_edit" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} /></th>
                <th className="px-3 py-1.5 text-right">{t('deleted')}</th>
                <th className="px-2 py-1.5 text-center w-12">{t('new')}</th>
                <th className="px-3 py-1.5 text-right">{t('month')}</th>
                <th className="px-3 py-1.5 text-right"><SortLink label={t('year')} sortKey="reg_year" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} /></th>
                <th className="px-3 py-1.5 text-center">{t('body_type')}</th>
                <th className="px-3 py-1.5 text-center"><SortLink label={t('fuel')} sortKey="fuel" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} /></th>
                <th className="px-3 py-1.5 text-right"><SortLink label={t('km')} sortKey="mileage" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {rows.length === 0 && (
                <tr><td colSpan={17} className="py-16 text-center text-gray-500">{t('no_deleted_listings_found')}</td></tr>
              )}
              {rows.map((row) => {
                const thumb = getListingThumbSrcFromParts(row);
                const thumbAlt = getListingThumbAlt(row);
                const listingSlug = row.mobile_id || row.cars_id || String(row.id);
                return (
                  <tr key={listingSlug} className="group bg-red-950/10 transition-colors hover:bg-red-950/20">
                    <td className="px-3 py-1">
                      <div className="flex items-start gap-2">
                        <ListingSearchPrefillButton listingId={row.id} />
                        <ListingThumbPreview
                          src={thumb}
                          href={`/listings/${listingSlug}`}
                          alt={thumbAlt}
                          previewAlt={`${thumbAlt} preview`}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <div className="font-medium text-white">{row.make ?? '—'}</div>
                      <div className="text-xs text-gray-400">{row.model ?? '—'}</div>
                    </td>
                    <td className="max-w-[200px] px-2 py-1.5">
                      <Link href={`/listings/${listingSlug}`} className="block whitespace-normal break-words text-xs text-gray-400 no-underline hover:text-gray-300 hover:no-underline">{row.title}</Link>
                    </td>
                    <td className="px-2 py-1.5 text-gray-400">{row.dealer_name ?? '—'}</td>
                    <td className="px-2 py-1 text-center"><AdStatusBadge status={row.ad_status} /></td>
                    <td className="pl-1 pr-3 py-1 text-right">
                      <ListingPriceCell price={row.current_price} vat={row.vat} />
                    </td>
                    <td className="px-3 py-1 text-center">
                      <VatBadge vat={row.vat} />
                    </td>
                    <td className="px-2 py-1 text-center"><KaparoBadge kaparo={row.kaparo} /></td>
                    <td className="px-3 py-1 text-right text-xs text-gray-300">{formatCount(row.views)}</td>
                    <td className="w-20 px-2 py-1 text-right text-xs text-gray-400"><span className="inline-block whitespace-pre-line leading-tight">{formatDate(row.last_edit)}</span></td>
                    <td className="w-20 px-2 py-1 text-right text-xs text-red-300"><span className="inline-block whitespace-pre-line leading-tight">{formatDate(row.deleted_at)}</span></td>
                    <td className="px-2 py-1 text-center">{row.is_new ? <span className="rounded-full bg-emerald-800/70 px-2 py-0.5 text-[11px] text-emerald-200">new</span> : <span className="text-gray-600">—</span>}</td>
                    <td className="px-3 py-1 text-right text-gray-300">{row.reg_month ?? '—'}</td>
                    <td className="px-3 py-1 text-right text-gray-300">{row.reg_year ?? '—'}</td>
                    <td className="px-3 py-1 text-center text-gray-300">{row.body_type ?? '—'}</td>
                    <td className="px-3 py-1 text-center text-gray-300">{row.fuel ?? '—'}</td>
                    <td className="px-3 py-1 text-right text-gray-300">{formatCount(row.mileage)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <ListingsPagination
          page={page}
          totalPages={totalPages}
          nextCursor={nextCursor}
          cursorActive={Boolean(cursor)}
          currentParams={currentParams}
          basePath={BASE_PATH}
        />
      </main>
    </div>
  );
}
