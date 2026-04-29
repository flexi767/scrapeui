import Link from 'next/link';
import { Suspense } from 'react';
import { ListingThumbPreview } from '@/components/ListingThumbPreview';
import ListingSearchPrefillButton from '@/components/ListingSearchPrefillButton';
import { AdStatusBadge } from '@/components/listings/AdStatusBadge';
import { ListingPriceCell } from '@/components/listings/ListingPriceCell';
import { SortLink } from '@/components/listings/SortLink';
import { KaparoBadge, VatBadge } from '@/components/listings/VatBadge';
import FilterBar from '@/components/FilterBar';
import { getAllDealers, getDistinctCategories, getDistinctFuels, getDistinctYears, getListings, getMakeModels, getPriceChangeRange, getPriceRange } from '@/lib/queries';
import { getListingThumbAlt, getListingThumbSrc } from '@/lib/listing-thumb';
import { formatDateOnly } from '@/lib/date-format';
import {
  buildListingParams,
  listingHref,
  listingPageHref,
  LISTING_EXTRA_OPTIONS,
  toParamArray,
} from '@/lib/listing-url';
import { formatDate } from '@/lib/utils';

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
}

const BASE_PATH = '/listings';

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
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
  const priceMin = sp.p_min !== undefined ? Number(sp.p_min) : null;
  const priceMax = sp.p_max !== undefined ? Number(sp.p_max) : null;
  const priceChangeMin = sp.pc_min !== undefined ? Number(sp.pc_min) : null;
  const priceChangeMax = sp.pc_max !== undefined ? Number(sp.pc_max) : null;
  const kaparo = sp.kaparo ?? '';
  const sort = sp.sort ?? 'price';
  const order = sp.order ?? 'desc';
  const search = sp.search ?? '';
  const page = parseInt(sp.page ?? '1', 10);

  const { data: rows, total } = getListings({
    make,
    model,
    dealerSlugs,
    years,
    categories,
    statuses,
    vatValues,
    fuels,
    extras,
    priceMin,
    priceMax,
    priceChangeMin,
    priceChangeMax,
    kaparo,
    sort,
    order,
    search,
    page,
    limit: 50,
  });

  const makeModels = getMakeModels();
  const allDealers = getAllDealers();
  const makes = Object.keys(makeModels).sort();

  // Build URL params object for sort links
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
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="min-h-screen bg-[#111827]">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-[1600px] px-4 py-3">
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
              priceChangeRange={getPriceChangeRange()}
              priceRange={getPriceRange()}
              showPageLinks={false}
            />
          </Suspense>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-4">
        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-700/60">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/60 text-xs font-medium uppercase tracking-wider text-gray-400">
                <th className="w-24 px-3 py-1.5 text-left">Img</th>
                <th className="px-3 py-1.5 text-left">Make / Model</th>
                <th className="px-3 py-1.5 text-left">Title</th>
                <th className="px-3 py-1.5 text-left">
                  <SortLink label="Dealer" sortKey="dealer" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} />
                </th>
                <th className="px-2 py-1.5 text-center w-14">
                  <SortLink label="Paid" sortKey="ad_status" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} />
                </th>
                <th className="pl-1 pr-3 py-1.5 text-right">
                  <SortLink label="Price" sortKey="price" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} />
                </th>
                <th className="px-3 py-1.5 text-center">VAT</th>
                <th className="px-2 py-1.5 text-center w-14">
                  <SortLink label="К" sortKey="kaparo" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} />
                </th>
                <th className="px-3 py-1.5 text-right">
                  <SortLink label="Views" sortKey="views" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} />
                </th>
                <th className="px-3 py-1.5 text-right">
                  <SortLink label="Last Edit" sortKey="last_edit" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} />
                </th>
                <th className="px-3 py-1.5 text-right">
                  <SortLink label="cars.bg created" sortKey="carsbg_created_date" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} />
                </th>
                <th className="px-2 py-1.5 text-center w-12">New</th>
                <th className="px-3 py-1.5 text-right">
                  <SortLink label="Year" sortKey="reg_year" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} />
                </th>
                <th className="w-16 px-2 py-1.5 text-left">
                  <span className="block whitespace-pre-line leading-tight">Body{`\n`}Type</span>
                </th>
                <th className="w-20 px-2 py-1.5 text-left">
                  <SortLink label="Fuel" sortKey="fuel" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} />
                </th>
                <th className="px-3 py-1.5 text-right">
                  <SortLink label="KM" sortKey="mileage" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={17} className="py-16 text-center text-gray-500">
                    No listings found
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const thumb = getListingThumbSrc(row);
                const thumbAlt = getListingThumbAlt(row);
                const listingSlug = row.mobile_id || row.cars_id || String(row.id);
                return (
                  <tr
                    key={listingSlug}
                    className="group transition-colors hover:bg-gray-800/40"
                  >
                    {/* Thumbnail */}
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

                    {/* Make + Model */}
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {row.make ? (
                        <Link
                          href={listingHref(BASE_PATH, currentParams, { make: row.make }, ['make', 'model'])}
                          className="block font-medium text-white no-underline hover:text-white hover:no-underline"
                        >
                          {row.make}
                        </Link>
                      ) : <div className="font-medium text-white">—</div>}
                      {row.model ? (
                        <Link
                          href={listingHref(BASE_PATH, currentParams, { make: row.make ?? '', model: row.model }, ['make', 'model'])}
                          className="block text-xs text-gray-400 no-underline hover:text-white hover:no-underline"
                        >
                          {row.model}
                        </Link>
                      ) : <div className="text-xs text-gray-400">—</div>}
                    </td>

                    {/* Title */}
                    <td className="max-w-[200px] px-2 py-1.5">
                      <Link
                        href={`/listings/${listingSlug}`}
                        className="block whitespace-normal break-words text-xs text-gray-400 no-underline hover:text-gray-300 hover:no-underline"
                      >
                        {row.title}
                      </Link>
                    </td>

                    {/* Dealer */}
                    <td className="px-2 py-1.5 text-gray-400">
                      <div className="flex items-center gap-1.5">
                        {row.dealer_slug ? (
                          <Link
                            href={listingHref(BASE_PATH, currentParams, { dealer: row.dealer_slug }, ['dealer'])}
                            className="whitespace-nowrap text-gray-400 no-underline hover:text-white hover:no-underline"
                          >
                            {row.dealer_name ?? '—'}
                          </Link>
                        ) : <span className="whitespace-nowrap text-gray-400">{row.dealer_name ?? '—'}</span>}
                        {row.source === 'c' && (
                          <span className="rounded bg-purple-900/70 px-1 py-0.5 text-[10px] text-purple-200">cars</span>
                        )}
                      </div>
                    </td>

                    {/* Ad Status */}
                    <td className="px-2 py-1 text-center">
                      <Link href={statuses.includes(row.ad_status || 'none') ? listingHref(BASE_PATH, currentParams, {}) : listingHref(BASE_PATH, currentParams, { status: row.ad_status || 'none' })}>
                        <AdStatusBadge status={row.ad_status} />
                      </Link>
                    </td>

                    {/* Price */}
                    <td className="pl-1 pr-3 py-1 text-right">
                      <ListingPriceCell
                        price={row.current_price}
                        vat={row.vat}
                        priceChange={row.price_change}
                        carsPrice={row.cars_price}
                        historyHref={row.mobile_id ? `/listings/${row.mobile_id}/history` : null}
                      />
                    </td>

                    {/* VAT */}
                    <td className="px-3 py-1 text-center">
                      <Link href={listingHref(BASE_PATH, currentParams, { vat: row.vat || 'null' }, ['vat'])}>
                        <VatBadge vat={row.vat} />
                      </Link>
                    </td>

                    {/* капаро */}
                    <td className="px-2 py-1 text-center">
                      <Link href={listingHref(BASE_PATH, currentParams, { kaparo: row.kaparo ? 'yes' : 'no' }, ['kaparo'])}>
                        <KaparoBadge kaparo={row.kaparo} />
                      </Link>
                    </td>

                    {/* Views */}
                    <td className="px-3 py-1 text-right text-xs text-gray-300">
                      <div>{row.views != null ? row.views.toLocaleString('en-US') : '—'}</div>
                      {row.cars_total_views != null && (
                        <div className="text-[11px] text-orange-200/85">
                          {row.cars_total_views.toLocaleString('en-US')}
                        </div>
                      )}
                    </td>

                    {/* Last Edit */}
                    <td className="w-20 px-2 py-1 text-right text-xs text-gray-400">
                      <span className="inline-block whitespace-pre-line leading-tight">
                        {formatDate(row.last_edit).replace(/,\s+/, '\n')}
                      </span>
                    </td>

                    {/* cars.bg created */}
                    <td className="w-20 px-2 py-1 text-right text-xs text-gray-400">
                      {formatDateOnly(row.carsbg_created_date)}
                    </td>

                    {/* New */}
                    <td className="px-2 py-1 text-center">
                      {row.is_new ? (
                        <span className="rounded-full bg-emerald-800/70 px-2 py-0.5 text-[11px] text-emerald-200">new</span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>

                    {/* Reg Year */}
                    <td className="px-3 py-1.5 text-right text-gray-400 text-xs">
                      <div>{row.reg_month ?? '—'}</div>
                      <div>
                        {row.reg_year ? (
                          <Link href={listingHref(BASE_PATH, currentParams, { year: row.reg_year })} className="text-gray-400 hover:text-white">
                            {row.reg_year}
                          </Link>
                        ) : <span className="text-gray-600">—</span>}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="w-16 px-2 py-1.5 text-gray-400 text-xs">
                      {row.body_type ? (
                        <Link href={listingHref(BASE_PATH, currentParams, { category: row.body_type }, ['category'])}>
                          <span className="block whitespace-normal wrap-break-word leading-tight text-xs text-gray-400 hover:text-gray-400">{row.body_type}</span>
                        </Link>
                      ) : <span className="text-gray-600">—</span>}
                    </td>

                    {/* Fuel */}
                    <td className="w-20 px-2 py-1.5 text-xs text-gray-400">
                      {row.fuel ? (
                        <Link href={listingHref(BASE_PATH, currentParams, { fuel: row.fuel }, ['fuel'])}>
                          <span className="block whitespace-normal break-words leading-tight text-xs text-gray-400 hover:text-gray-400">{row.fuel}</span>
                        </Link>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    {/* Mileage */}
                    <td className="px-2 py-1.5 text-right text-gray-400 text-xs whitespace-nowrap">
                      {row.mileage != null ? row.mileage.toLocaleString('en-US') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm">
            {page > 1 && (
              <Link
                href={listingPageHref(BASE_PATH, currentParams, page - 1)}
                className="rounded border border-gray-600 px-3 py-1.5 text-gray-300 hover:border-gray-400 hover:text-white"
              >
                Prev
              </Link>
            )}
            {pageNumbers.map((pageNumber) => (
              pageNumber === page ? (
                <span
                  key={pageNumber}
                  className="min-w-9 cursor-default rounded border border-blue-500 bg-blue-500/15 px-3 py-1.5 text-center text-white"
                >
                  {pageNumber}
                </span>
              ) : (
                <Link
                  key={pageNumber}
                  href={listingPageHref(BASE_PATH, currentParams, pageNumber)}
                  className="min-w-9 rounded border border-gray-600 px-3 py-1.5 text-center text-gray-300 hover:border-gray-400 hover:text-white"
                >
                  {pageNumber}
                </Link>
              )
            ))}
            {page < totalPages && (
              <Link
                href={listingPageHref(BASE_PATH, currentParams, page + 1)}
                className="rounded border border-gray-600 px-3 py-1.5 text-gray-300 hover:border-gray-400 hover:text-white"
              >
                Next
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
