import Link from 'next/link';
import { Suspense } from 'react';
import FilterBar from '@/components/FilterBar';
import ListingsTableClient from '@/components/ListingsTableClient';
import { getAllDealers, getCompetitorStatsByMakeModel, getDistinctFuels, getDistinctYears, getListings, getMakeModels, getPriceChangeRange, getPriceRange } from '@/lib/queries';

interface SearchParams {
  make?: string;
  model?: string;
  dealer?: string | string[];
  year?: string | string[];
  status?: string | string[];
  vat?: string | string[];
  fuel?: string | string[];
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

function SortLink({
  label,
  sortKey,
  currentSort,
  currentOrder,
  params,
}: {
  label: string;
  sortKey: string;
  currentSort: string;
  currentOrder: string;
  params: URLSearchParams;
}) {
  const p = new URLSearchParams(params.toString());
  p.delete('page');
  if (currentSort === sortKey) {
    p.set('order', currentOrder === 'asc' ? 'desc' : 'asc');
  } else {
    p.set('sort', sortKey);
    p.set('order', 'desc');
  }
  const arrow = currentSort === sortKey ? (currentOrder === 'asc' ? ' ↑' : ' ↓') : '';
  return (
    <Link href={`/listings?${p.toString()}`} className="hover:text-white">
      {label}{arrow}
    </Link>
  );
}

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const make = sp.make ?? '';
  const model = sp.model ?? '';
  const dealerSlugs = sp.dealer
    ? Array.isArray(sp.dealer) ? sp.dealer : [sp.dealer]
    : [];
  const years = sp.year ? (Array.isArray(sp.year) ? sp.year : [sp.year]) : [];
  const statuses = sp.status ? (Array.isArray(sp.status) ? sp.status : [sp.status]) : [];
  const vatValues = sp.vat ? (Array.isArray(sp.vat) ? sp.vat : [sp.vat]) : [];
  const fuels = sp.fuel ? (Array.isArray(sp.fuel) ? sp.fuel : [sp.fuel]) : [];
  const priceMin = sp.p_min !== undefined ? Number(sp.p_min) : null;
  const priceMax = sp.p_max !== undefined ? Number(sp.p_max) : null;
  const priceChangeMin = sp.pc_min !== undefined ? Number(sp.pc_min) : null;
  const priceChangeMax = sp.pc_max !== undefined ? Number(sp.pc_max) : null;
  const kaparo = sp.kaparo ?? '';
  const sort = sp.sort ?? 'dealer';
  const order = sp.order ?? 'desc';
  const search = sp.search ?? '';
  const page = parseInt(sp.page ?? '1', 10);

  const { data: rows, total } = getListings({
    make, model, dealerSlugs, years, statuses, vatValues, fuels,
    priceMin, priceMax, priceChangeMin, priceChangeMax,
    kaparo, sort, order, search, page, limit: 50,
  });

  const makeModels = getMakeModels();
  const allDealers = getAllDealers();
  const makes = Object.keys(makeModels).sort();

  // Competitor stats: map of "make|||model" → stats
  const cmptMap = getCompetitorStatsByMakeModel();
  const competitorStats = Object.fromEntries(cmptMap.entries());

  // Build URL params for sort links and client table
  const currentParams = new URLSearchParams();
  for (const s of statuses) currentParams.append('status', s);
  for (const v of vatValues) currentParams.append('vat', v);
  for (const f of fuels) currentParams.append('fuel', f);
  if (kaparo) currentParams.set('kaparo', kaparo);
  if (make) currentParams.set('make', make);
  if (model) currentParams.set('model', model);
  for (const d of dealerSlugs) currentParams.append('dealer', d);
  for (const y of years) currentParams.append('year', y);
  if (search) currentParams.set('search', search);
  currentParams.set('sort', sort);
  currentParams.set('order', order);

  const totalPages = Math.ceil(total / 50);

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
              allFuels={getDistinctFuels()}
              total={total}
              priceChangeRange={getPriceChangeRange()}
              priceRange={getPriceRange()}
            />
          </Suspense>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-4">
        {/* Sort header row (server-rendered for SEO / no hydration) */}
        <div className="mb-1 overflow-x-auto rounded-t-lg border border-b-0 border-gray-700/60 bg-gray-800/60">
          <table className="w-full min-w-[900px] text-xs font-medium uppercase tracking-wider text-gray-400">
            <thead>
              <tr>
                <th className="w-8 px-2 py-1.5" />
                <th className="w-16 px-3 py-1.5 text-left">Img</th>
                <th className="px-3 py-1.5 text-left">Make / Model</th>
                <th className="px-3 py-1.5 text-left">Title</th>
                <th className="px-3 py-1.5 text-left">
                  <SortLink label="Dealer" sortKey="dealer" currentSort={sort} currentOrder={order} params={currentParams} />
                </th>
                <th className="px-2 py-1.5 text-center w-14">
                  <SortLink label="Paid" sortKey="ad_status" currentSort={sort} currentOrder={order} params={currentParams} />
                </th>
                <th className="pl-1 pr-3 py-1.5 text-right">
                  <SortLink label="Price" sortKey="price" currentSort={sort} currentOrder={order} params={currentParams} />
                </th>
                <th className="px-2 py-1.5 text-center w-12" title="vs. competitor avg price">Mkt%</th>
                <th className="px-3 py-1.5 text-center">VAT</th>
                <th className="px-2 py-1.5 text-center w-10">К</th>
                <th className="px-3 py-1.5 text-right">
                  <SortLink label="Last Edit" sortKey="last_edit" currentSort={sort} currentOrder={order} params={currentParams} />
                </th>
                <th className="px-2 py-1.5 text-center w-12">New</th>
                <th className="px-3 py-1.5 text-right">
                  <SortLink label="Year" sortKey="reg_year" currentSort={sort} currentOrder={order} params={currentParams} />
                </th>
                <th className="px-3 py-1.5 text-center">
                  <SortLink label="Fuel" sortKey="fuel" currentSort={sort} currentOrder={order} params={currentParams} />
                </th>
                <th className="px-3 py-1.5 text-right">
                  <SortLink label="KM" sortKey="mileage" currentSort={sort} currentOrder={order} params={currentParams} />
                </th>
              </tr>
            </thead>
          </table>
        </div>

        {/* Client table with bulk actions + competitor inline */}
        <div className="rounded-b-lg border border-gray-700/60">
          {rows.length === 0 ? (
            <div className="py-16 text-center text-gray-500 text-sm">No listings found</div>
          ) : (
            <ListingsTableClient
              rows={rows}
              competitorStats={competitorStats}
              currentParams={currentParams.toString()}
              statuses={statuses}
            />
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm">
            {page > 1 && (
              <Link
                href={`/listings?${new URLSearchParams({ ...Object.fromEntries(currentParams), page: String(page - 1) }).toString()}`}
                className="rounded border border-gray-600 px-3 py-1.5 text-gray-300 hover:border-gray-400 hover:text-white"
              >
                ← Prev
              </Link>
            )}
            <span className="text-gray-400">Page {page} of {totalPages}</span>
            {page < totalPages && (
              <Link
                href={`/listings?${new URLSearchParams({ ...Object.fromEntries(currentParams), page: String(page + 1) }).toString()}`}
                className="rounded border border-gray-600 px-3 py-1.5 text-gray-300 hover:border-gray-400 hover:text-white"
              >
                Next →
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
