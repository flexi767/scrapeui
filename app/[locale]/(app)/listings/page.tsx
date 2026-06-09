
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requirePagePermission } from '@/lib/api/auth-helpers';
import FilterBar from '@/components/FilterBar';
import { SortLink } from '@/components/listings/SortLink';
import { ListingTableRow } from '@/components/listings/ListingTableRow';
import { ListingsPagination } from '@/components/listings/ListingsPagination';
import { getAllDealers, getDistinctCategories, getDistinctFuels, getDistinctYears, getListings, getMakeModels, getPriceRanges } from '@/lib/queries';
import {
  buildListingParams,
  LISTING_EXTRA_OPTIONS,
  ListingSearchParams,
  parseListingSearchParams,
} from '@/lib/listing-url';

const BASE_PATH = '/listings';

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<ListingSearchParams>;
}) {
  const pageAccess = await requirePagePermission('listings');
  if ('redirect' in pageAccess) redirect(pageAccess.redirect);

  const t = await getTranslations('ui');
  const sp = await searchParams;
  const {
    make, model, dealerSlugs, years, categories, statuses, vatValues, fuels, extras,
    priceMin, priceMax, priceChangeMin, priceChangeMax, kaparo, sort, order, search, page,
  } = parseListingSearchParams(sp, 'price');

  const { data: rows, total } = getListings({
    make, model, dealerSlugs, years, categories, statuses, vatValues, fuels, extras,
    priceMin, priceMax, priceChangeMin, priceChangeMax, kaparo, sort, order, search,
    page, limit: 50,
  });

  const makeModels = getMakeModels();
  const allDealers = getAllDealers();
  const makes = Object.keys(makeModels).sort();
  const { priceRange, priceChangeRange } = getPriceRanges();

  const currentParams = buildListingParams({
    statuses, vatValues, categories, fuels, extras, kaparo,
    make, model, dealerSlugs, years, search, sort, order,
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
              showPageLinks={false}
            />
          </Suspense>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-2">
        <div className="overflow-x-auto rounded-lg border border-gray-700/60">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/60 text-xs font-medium uppercase tracking-wider text-gray-400">
                <th className="w-24 px-3 py-1.5 text-left">{t('img')}</th>
                <th className="px-3 py-1.5 text-left">{t('make_/_model')}</th>
                <th className="px-3 py-1.5 text-left">{t('title')}</th>
                <th className="px-3 py-1.5 text-left">
                  <SortLink label={t('dealer')} sortKey="dealer" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} />
                </th>
                <th className="px-2 py-1.5 text-center w-14">
                  <SortLink label={t('paid')} sortKey="ad_status" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} />
                </th>
                <th className="pl-1 pr-3 py-1.5 text-right">
                  <SortLink label={t('price')} sortKey="price" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} />
                </th>
                <th className="px-3 py-1.5 text-center">{t('vat')}</th>
                <th className="px-2 py-1.5 text-center w-14">
                  <SortLink label={t('к')} sortKey="kaparo" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} />
                </th>
                <th className="px-3 py-1.5 text-right">
                  <SortLink label={t('views')} sortKey="views" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} />
                </th>
                <th className="px-3 py-1.5 text-right">
                  <SortLink label={t('last_edit')} sortKey="last_edit" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} />
                </th>
                <th className="px-3 py-1.5 text-right">
                  <SortLink label={t('carsbg_created')} sortKey="carsbg_created_date" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} />
                </th>
                <th className="px-2 py-1.5 text-center w-12">{t('new')}</th>
                <th className="px-3 py-1.5 text-right">
                  <SortLink label={t('year')} sortKey="reg_year" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} />
                </th>
                <th className="w-16 px-2 py-1.5 text-left">
                  <span className="block whitespace-pre-line leading-tight">{t('body_type_col')}</span>
                </th>
                <th className="w-20 px-2 py-1.5 text-left">
                  <SortLink label={t('fuel')} sortKey="fuel" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} />
                </th>
                <th className="px-3 py-1.5 text-right">
                  <SortLink label={t('km')} sortKey="mileage" currentSort={sort} currentOrder={order} params={currentParams} basePath={BASE_PATH} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={17} className="py-16 text-center text-gray-500">
                    {t('no_listings_found')}
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <ListingTableRow
                  key={row.mobile_id || row.cars_id || String(row.id)}
                  row={row}
                  currentParams={currentParams}
                  statuses={statuses}
                  basePath={BASE_PATH}
                />
              ))}
            </tbody>
          </table>
        </div>

        <ListingsPagination
          page={page}
          totalPages={totalPages}
          currentParams={currentParams}
          basePath={BASE_PATH}
        />
      </main>
    </div>
  );
}
