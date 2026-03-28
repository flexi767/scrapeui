import Link from 'next/link';
import { Suspense } from 'react';
import FilterBar from '@/components/FilterBar';
import { getAllDealers, getDistinctFuels, getDistinctYears, getListings, getMakeModels, getPriceChangeRange, getPriceRange } from '@/lib/queries';
import RangeFilter from '@/components/RangeFilter';
import { buildImageList, formatDate, formatMileage, formatPrice, parseJson } from '@/lib/utils';

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

function AdStatusBadge({ status }: { status: string }) {
  if (!status || status === 'none') {
    return <span className="text-gray-600">—</span>;
  }
  if (status.toUpperCase() === 'TOP') {
    return <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{backgroundColor:'#1a6496'}}>TOP</span>;
  }
  if (status.toUpperCase() === 'VIP') {
    return <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{backgroundColor:'#c0392b'}}>VIP</span>;
  }
  return <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[11px] text-gray-300">{status}</span>;
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
  const arrow =
    currentSort === sortKey ? (currentOrder === 'asc' ? ' ↑' : ' ↓') : '';
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
    ? Array.isArray(sp.dealer)
      ? sp.dealer
      : [sp.dealer]
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
  const allDealers = getAllDealers();
  const makes = Object.keys(makeModels).sort();

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
        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-700/60">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/60 text-xs font-medium uppercase tracking-wider text-gray-400">
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
                <th className="px-3 py-1.5 text-center">VAT</th>
                <th className="px-2 py-1.5 text-center w-14">
                  <SortLink label="К" sortKey="kaparo" currentSort={sort} currentOrder={order} params={currentParams} />
                </th>
                <th className="px-3 py-1.5 text-right">
                  <SortLink label="Last Edit" sortKey="last_edit" currentSort={sort} currentOrder={order} params={currentParams} />
                </th>
                <th className="px-2 py-1.5 text-center w-12">New</th>
                <th className="px-3 py-1.5 text-right">Month</th>
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
            <tbody className="divide-y divide-gray-700/50">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={14} className="py-16 text-center text-gray-500">
                    No listings found
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const imageMeta = parseJson<{ cdn: string; shard: string } | null>(row.image_meta, null);
                const thumbKeys = parseJson<string[]>(row.thumb_keys, []);
                const fullKeys = parseJson<string[]>(row.full_keys, []);
                const images = buildImageList(
                  row.mobile_id,
                  fullKeys.length ? fullKeys : thumbKeys,
                  thumbKeys,
                  imageMeta,
                  row.images_downloaded === 1,
                );
                const thumb = images[0]?.thumb ?? null;

                return (
                  <tr
                    key={row.mobile_id}
                    className="group transition-colors hover:bg-gray-800/40"
                  >
                    {/* Thumbnail */}
                    <td className="px-3 py-1">
                      {thumb ? (
                        <div className="relative inline-block w-16">
                          <Link href={`/listings/${row.mobile_id}`} className="peer block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={thumb}
                              alt=""
                              className="w-16 rounded object-contain"
                              style={{aspectRatio:'4/3'}}
                            />
                          </Link>
                          {/* Hover preview — shown via peer-hover, pointer-events-none so it doesn't interfere */}
                          <div className="pointer-events-none absolute left-full top-0 z-50 ml-2 hidden w-64 peer-hover:block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={thumb}
                              alt=""
                              className="w-full rounded shadow-xl"
                              style={{aspectRatio:'4/3'}}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="h-10 w-14 rounded bg-gray-700" />
                      )}
                    </td>

                    {/* Make + Model */}
                    <td className="px-3 py-1">
                      {row.make ? (
                        <Link
                          href={`/listings?${new URLSearchParams([...Array.from(currentParams.entries()).filter(([k]) => k !== 'make' && k !== 'model' && k !== 'page'), ['make', row.make]]).toString()}`}
                          className="block font-medium text-white no-underline hover:text-white hover:no-underline"
                        >
                          {row.make}
                        </Link>
                      ) : <div className="font-medium text-gray-200">—</div>}
                      {row.model ? (
                        <Link
                          href={`/listings?${new URLSearchParams([...Array.from(currentParams.entries()).filter(([k]) => k !== 'make' && k !== 'model' && k !== 'page'), ['make', row.make ?? ''], ['model', row.model]]).toString()}`}
                          className="block text-xs text-gray-400 no-underline hover:text-white hover:no-underline"
                        >
                          {row.model}
                        </Link>
                      ) : <div className="text-xs text-gray-400">—</div>}
                    </td>

                    {/* Title */}
                    <td className="max-w-xs px-3 py-1">
                      <Link
                        href={`/listings/${row.mobile_id}`}
                        className="line-clamp-2 text-white no-underline hover:text-white hover:no-underline"
                      >
                        {row.title}
                      </Link>
                    </td>

                    {/* Dealer */}
                    <td className="px-3 py-1">
                      {row.dealer_slug ? (
                        <Link
                          href={`/listings?${new URLSearchParams([...Array.from(currentParams.entries()).filter(([k]) => k !== 'dealer' && k !== 'page'), ['dealer', row.dealer_slug]]).toString()}`}
                          className="text-white no-underline hover:text-white hover:no-underline"
                        >
                          {row.dealer_name ?? '—'}
                        </Link>
                      ) : <span className="text-gray-300">{row.dealer_name ?? '—'}</span>}
                    </td>

                    {/* Ad Status */}
                    <td className="px-2 py-1 text-center">
                      <Link href={`/listings?${new URLSearchParams([...Array.from(currentParams.entries()).filter(([k]) => k !== 'page'), ...(!statuses.includes(row.ad_status || 'none') ? [['status', row.ad_status || 'none'] as [string,string]] : [])]).toString()}`}>
                        <AdStatusBadge status={row.ad_status} />
                      </Link>
                    </td>

                    {/* Price */}
                    <td className="pl-1 pr-3 py-1 text-right font-semibold text-green-400">
                      <span className="flex items-center justify-end gap-1">
                        {row.price_change != null && (
                          <Link href={`/listings/${row.mobile_id}/history`} title={`${row.price_change > 0 ? '+' : ''}${row.price_change}`} className="text-sm">
                            <span className={row.price_change < 0 ? 'text-green-400' : 'text-red-400'}>
                              {row.price_change < 0 ? '↘' : '↗'}
                            </span>
                          </Link>
                        )}
                        {formatPrice(row.current_price)}
                      </span>
                    </td>

                    {/* VAT */}
                    <td className="px-3 py-1 text-center">
                      <Link href={`/listings?${new URLSearchParams([...Array.from(currentParams.entries()).filter(([k]) => k !== 'page' && k !== 'vat'), ['vat', row.vat || 'null']]).toString()}`}>
                        {row.vat === 'included' ? (
                          <span className="rounded-full bg-blue-900/70 px-2 py-0.5 text-[11px] text-blue-200">има</span>
                        ) : row.vat === 'exempt' ? (
                          <span className="rounded-full bg-green-900/70 px-2 py-0.5 text-[11px] text-green-200">няма</span>
                        ) : row.vat === 'excluded' ? (
                          <span className="rounded-full bg-red-900/70 px-2 py-0.5 text-[11px] text-red-200">+ДДС</span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </Link>
                    </td>

                    {/* капаро */}
                    <td className="px-2 py-1 text-center">
                      <Link href={`/listings?${new URLSearchParams([...Array.from(currentParams.entries()).filter(([k]) => k !== 'page' && k !== 'kaparo'), ['kaparo', row.kaparo ? 'yes' : 'no']]).toString()}`}>
                        {row.kaparo ? (
                          <span className="rounded-full bg-orange-900/70 px-2 py-0.5 text-[11px] text-orange-200">К</span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </Link>
                    </td>

                    {/* Last Edit */}
                    <td className="px-3 py-1 text-right text-xs text-gray-400">
                      {formatDate(row.last_edit)}
                    </td>

                    {/* New */}
                    <td className="px-2 py-1 text-center">
                      {row.is_new ? (
                        <span className="rounded-full bg-emerald-800/70 px-2 py-0.5 text-[11px] text-emerald-200">new</span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>

                    {/* Reg Month */}
                    <td className="px-3 py-1 text-right text-gray-300">
                      {row.reg_month ?? '—'}
                    </td>

                    {/* Reg Year */}
                    <td className="px-3 py-1 text-right">
                      {row.reg_year ? (
                        <Link href={`/listings?${new URLSearchParams([...Array.from(currentParams.entries()), ['year', row.reg_year]]).toString()}`} className="text-gray-300 hover:text-white">
                          {row.reg_year}
                        </Link>
                      ) : <span className="text-gray-600">—</span>}
                    </td>

                    {/* Fuel */}
                    <td className="px-3 py-1 text-center">
                      {row.fuel ? (
                        <Link href={`/listings?${new URLSearchParams([...Array.from(currentParams.entries()).filter(([k]) => k !== 'page' && k !== 'fuel'), ['fuel', row.fuel]]).toString()}`}>
                          <span className="text-xs text-gray-300 hover:text-white">{row.fuel}</span>
                        </Link>
                      ) : null}
                    </td>
                    {/* Mileage */}
                    <td className="px-3 py-1 text-right text-gray-300">
                      {formatMileage(row.mileage)}
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
                href={`/listings?${new URLSearchParams({ ...Object.fromEntries(currentParams), page: String(page - 1) }).toString()}`}
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
