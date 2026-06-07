
import Link from 'next/link';
import { Suspense } from 'react';
import FilterBar from '@/components/FilterBar';
import { getAllDealers, getDistinctCategories, getDistinctFuels, getDistinctYears, getEditOwnSyncRows, getOwnListings, getMakeModels, getPriceChangeRange, getPriceRange } from '@/lib/queries';
import { parseOptionalNum, toParamArray } from '@/lib/listing-url';
import OwnListingsTable from '@/components/OwnListingsTable';

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

export default async function EditOwnPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const make = sp.make ?? '';
  const model = sp.model ?? '';
  const dealerSlugs = toParamArray(sp.dealer);
  const years = toParamArray(sp.year);
  const statuses = toParamArray(sp.status);
  const vatValues = toParamArray(sp.vat);
  const fuels = toParamArray(sp.fuel);
  const priceMin = parseOptionalNum(sp.p_min);
  const priceMax = parseOptionalNum(sp.p_max);
  const priceChangeMin = parseOptionalNum(sp.pc_min);
  const priceChangeMax = parseOptionalNum(sp.pc_max);
  const kaparo = sp.kaparo ?? '';
  const sort = sp.sort ?? 'last_edit';
  const order = sp.order ?? 'desc';
  const search = sp.search ?? '';
  const page = parseInt(sp.page ?? '1', 10);

  const { data: rows, total } = getOwnListings({
    make,
    model,
    dealerSlugs,
    years,
    statuses,
    vatValues,
    fuels,
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
  const allOwnDealers = getAllDealers().filter(d => d.own);
  const makes = Object.keys(makeModels).sort();
  const dirtyCount = getEditOwnSyncRows().filter((row) => row.needs_sync === 1).length;

  // Build URL params object for sort links
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

  // Build pagination params preserving multi-value query params
  const prevPageParams = new URLSearchParams(currentParams.toString());
  prevPageParams.set('page', String(page - 1));
  const nextPageParams = new URLSearchParams(currentParams.toString());
  nextPageParams.set('page', String(page + 1));

  return (
    <div className="min-h-screen bg-[#111827]">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-[1600px] px-4 py-3">
          <Suspense>
            <FilterBar
              makes={makes}
              makeModels={makeModels}
              allDealers={allOwnDealers}
              allYears={getDistinctYears()}
              allCategories={getDistinctCategories()}
              allFuels={getDistinctFuels()}
              total={total}
              priceChangeRange={getPriceChangeRange()}
              priceRange={getPriceRange()}
              basePath="/editown"
              showPageLinks={false}
              syncHref={dirtyCount > 0 ? '/editown/sync?autorun=1' : '/editown/sync'}
              syncLabel={dirtyCount > 0 ? `Sync (${dirtyCount})` : 'Sync'}
              syncActive={dirtyCount > 0}
            />
          </Suspense>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-4">
        <OwnListingsTable key={currentParams.toString()} initialRows={rows} />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm">
            {page > 1 && (
              <Link
                href={`/editown?${prevPageParams.toString()}`}
                className="rounded border border-gray-600 px-3 py-1.5 text-gray-300 hover:border-gray-400 hover:text-white"
              >
                ← Prev
              </Link>
            )}
            <span className="text-gray-400">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`/editown?${nextPageParams.toString()}`}
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
