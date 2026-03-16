import Link from 'next/link';
import { Suspense } from 'react';
import FilterBar from '@/components/FilterBar';
import { getAllDealers, getDistinctYears, getListings, getMakeModels } from '@/lib/queries';
import { buildImageList, formatDate, formatMileage, formatPrice, parseJson } from '@/lib/utils';

interface SearchParams {
  make?: string;
  model?: string;
  dealer?: string | string[];
  year?: string | string[];
  status?: string | string[];
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
    <Link href={`/?${p.toString()}`} className="hover:text-white">
      {label}{arrow}
    </Link>
  );
}

export default async function HomePage({
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
  const sort = sp.sort ?? 'last_edit';
  const order = sp.order ?? 'desc';
  const search = sp.search ?? '';
  const page = parseInt(sp.page ?? '1', 10);

  const { data: rows, total } = getListings({
    make,
    model,
    dealerSlugs,
    years,
    statuses,
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
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-gray-400">
              {total.toLocaleString()} listing{total !== 1 ? 's' : ''}
            </span>
            <Link href="/config" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
              ⚙ Config
            </Link>
          </div>
          <Suspense>
            <FilterBar
              makes={makes}
              makeModels={makeModels}
              allDealers={allDealers}
              allYears={getDistinctYears()}
              selectedYears={years}
              selectedStatuses={statuses}
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
                  <SortLink label="Status" sortKey="ad_status" currentSort={sort} currentOrder={order} params={currentParams} />
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
                <th className="px-3 py-1.5 text-right">
                  <SortLink label="KM" sortKey="mileage" currentSort={sort} currentOrder={order} params={currentParams} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={13} className="py-16 text-center text-gray-500">
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
                          href={`/?${new URLSearchParams([...currentParams.entries().filter(([k]) => k !== 'make' && k !== 'model' && k !== 'page'), ['make', row.make]]).toString()}`}
                          className="block font-medium text-white no-underline hover:text-white hover:no-underline"
                        >
                          {row.make}
                        </Link>
                      ) : <div className="font-medium text-gray-200">—</div>}
                      {row.model ? (
                        <Link
                          href={`/?${new URLSearchParams([...currentParams.entries().filter(([k]) => k !== 'make' && k !== 'model' && k !== 'page'), ['make', row.make ?? ''], ['model', row.model]]).toString()}`}
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
                          href={`/?${new URLSearchParams([...currentParams.entries().filter(([k]) => k !== 'dealer' && k !== 'page'), ['dealer', row.dealer_slug]]).toString()}`}
                          className="text-white no-underline hover:text-white hover:no-underline"
                        >
                          {row.dealer_name ?? '—'}
                        </Link>
                      ) : <span className="text-gray-300">{row.dealer_name ?? '—'}</span>}
                    </td>

                    {/* Ad Status */}
                    <td className="px-2 py-1 text-center">
                      {row.ad_status && row.ad_status !== 'none' ? (
                        <Link href={`/?${new URLSearchParams([...currentParams.entries().filter(([k]) => k !== 'page'), ...(!statuses.includes(row.ad_status) ? [['status', row.ad_status] as [string,string]] : [])]).toString()}`}>
                          <AdStatusBadge status={row.ad_status} />
                        </Link>
                      ) : (
                        <AdStatusBadge status={row.ad_status} />
                      )}
                    </td>

                    {/* Price */}
                    <td className="pl-1 pr-3 py-1 text-right font-semibold text-green-400">
                      {formatPrice(row.current_price)}
                    </td>

                    {/* VAT */}
                    <td className="px-3 py-1 text-center">
                      {row.vat === 'included' ? (
                        <span className="rounded-full bg-blue-900/70 px-2 py-0.5 text-[11px] text-blue-200">има</span>
                      ) : row.vat === 'exempt' ? (
                        <span className="rounded-full bg-green-900/70 px-2 py-0.5 text-[11px] text-green-200">няма</span>
                      ) : row.vat === 'excluded' ? (
                        <span className="rounded-full bg-red-900/70 px-2 py-0.5 text-[11px] text-red-200">+ДДС</span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>

                    {/* капаро */}
                    <td className="px-2 py-1 text-center">
                      {row.kaparo ? (
                        <span className="rounded-full bg-orange-900/70 px-2 py-0.5 text-[11px] text-orange-200">К</span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
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
                        <Link href={`/?${new URLSearchParams([...currentParams.entries(), ['year', row.reg_year]]).toString()}`} className="text-gray-300 hover:text-white">
                          {row.reg_year}
                        </Link>
                      ) : <span className="text-gray-600">—</span>}
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
                href={`/?${new URLSearchParams({ ...Object.fromEntries(currentParams), page: String(page - 1) }).toString()}`}
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
                href={`/?${new URLSearchParams({ ...Object.fromEntries(currentParams), page: String(page + 1) }).toString()}`}
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
