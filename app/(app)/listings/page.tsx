import { Suspense } from 'react';
import FilterBar from '@/components/FilterBar';
import { SortLink } from '@/components/listings/SortLink';
import { ListingTableRow } from '@/components/listings/ListingTableRow';
import { ListingsPagination } from '@/components/listings/ListingsPagination';
import { getAllDealers, getDistinctCategories, getDistinctFuels, getDistinctYears, getListings, getMakeModels, getPriceChangeRange, getPriceRange } from '@/lib/queries';
import {
  buildListingParams,
  LISTING_EXTRA_OPTIONS,
  toParamArray,
} from '@/lib/listing-url';

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
    make, model, dealerSlugs, years, categories, statuses, vatValues, fuels, extras,
    priceMin, priceMax, priceChangeMin, priceChangeMax, kaparo, sort, order, search,
    page, limit: 50,
  });

  const makeModels = getMakeModels();
  const allDealers = getAllDealers();
  const makes = Object.keys(makeModels).sort();

  const currentParams = buildListingParams({
    statuses, vatValues, categories, fuels, extras, kaparo,
    make, model, dealerSlugs, years, search, sort, order,
  });

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="min-h-screen bg-[#111827]">
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
