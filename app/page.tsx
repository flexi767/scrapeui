import Link from 'next/link';
import { Suspense } from 'react';
import FilterBar from '@/components/FilterBar';
import { getAllDealers, getListings, getMakeModels } from '@/lib/queries';
import { buildImageList, formatDate, formatMileage, formatPrice, parseJson } from '@/lib/utils';

interface SearchParams {
  make?: string;
  model?: string;
  dealer?: string | string[];
  sort?: string;
  order?: string;
  search?: string;
  page?: string;
}

function AdStatusBadge({ status }: { status: string }) {
  if (!status || status === 'none') {
    return <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[11px] text-gray-300">—</span>;
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
  const sort = sp.sort ?? 'last_edit';
  const order = sp.order ?? 'desc';
  const search = sp.search ?? '';
  const page = parseInt(sp.page ?? '1', 10);

  const { data: rows, total } = getListings({
    make,
    model,
    dealerSlugs,
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
  if (make) currentParams.set('make', make);
  if (model) currentParams.set('model', model);
  for (const d of dealerSlugs) currentParams.append('dealer', d);
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
            <h1 className="text-lg font-semibold text-white">
              Competitor Listings Tracker
            </h1>
            <span className="text-sm text-gray-400">
              {total.toLocaleString()} listing{total !== 1 ? 's' : ''}
            </span>
          </div>
          <Suspense>
            <FilterBar
              makes={makes}
              makeModels={makeModels}
              allDealers={allDealers}
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
                <th className="w-16 px-3 py-3 text-left">Img</th>
                <th className="px-3 py-3 text-left">Make / Model</th>
                <th className="px-3 py-3 text-left">Title</th>
                <th className="px-3 py-3 text-left">Dealer</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-right">
                  <SortLink label="Price" sortKey="price" currentSort={sort} currentOrder={order} params={currentParams} />
                </th>
                <th className="px-3 py-3 text-center">VAT</th>
                <th className="px-3 py-3 text-center">капаро</th>
                <th className="px-3 py-3 text-right">
                  <SortLink label="Last Edit" sortKey="last_edit" currentSort={sort} currentOrder={order} params={currentParams} />
                </th>
                <th className="px-3 py-3 text-right">
                  <SortLink label="KM" sortKey="mileage" currentSort={sort} currentOrder={order} params={currentParams} />
                </th>
                <th className="px-3 py-3 text-right">Year</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-gray-500">
                    No listings found
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const imageMeta = parseJson<{ cdn: string; shard: string } | null>(row.image_meta, null);
                const thumbKeys = parseJson<string[]>(row.thumb_keys, []);
                const images = buildImageList(
                  row.mobile_id,
                  thumbKeys,
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
                    <td className="px-3 py-2">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt=""
                          className="h-10 w-14 rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-14 rounded bg-gray-700" />
                      )}
                    </td>

                    {/* Make + Model */}
                    <td className="px-3 py-2">
                      {row.make ? (
                        <Link
                          href={`/?make=${encodeURIComponent(row.make)}`}
                          className="block font-medium text-white no-underline hover:text-white hover:no-underline"
                        >
                          {row.make}
                        </Link>
                      ) : <div className="font-medium text-gray-200">—</div>}
                      {row.model ? (
                        <Link
                          href={`/?make=${encodeURIComponent(row.make ?? '')}&model=${encodeURIComponent(row.model)}`}
                          className="block text-xs text-gray-400 no-underline hover:text-white hover:no-underline"
                        >
                          {row.model}
                        </Link>
                      ) : <div className="text-xs text-gray-400">—</div>}
                    </td>

                    {/* Title */}
                    <td className="max-w-xs px-3 py-2">
                      <Link
                        href={`/listings/${row.mobile_id}`}
                        className="line-clamp-2 text-white no-underline hover:text-white hover:no-underline"
                      >
                        {row.title}
                      </Link>
                    </td>

                    {/* Dealer */}
                    <td className="px-3 py-2">
                      {row.dealer_slug ? (
                        <Link
                          href={`/?dealer=${encodeURIComponent(row.dealer_slug)}`}
                          className="text-white no-underline hover:text-white hover:no-underline"
                        >
                          {row.dealer_name ?? '—'}
                        </Link>
                      ) : <span className="text-gray-300">{row.dealer_name ?? '—'}</span>}
                    </td>

                    {/* Ad Status */}
                    <td className="px-3 py-2">
                      <AdStatusBadge status={row.ad_status} />
                    </td>

                    {/* Price */}
                    <td className="px-3 py-2 text-right font-semibold text-green-400">
                      {formatPrice(row.current_price)}
                    </td>

                    {/* VAT */}
                    <td className="px-3 py-2 text-center">
                      {row.vat === 'included' ? (
                        <span className="rounded-full bg-blue-900/70 px-2 py-0.5 text-[11px] text-blue-200">има</span>
                      ) : row.vat === 'exempt' ? (
                        <span className="rounded-full bg-green-900/70 px-2 py-0.5 text-[11px] text-green-200">няма</span>
                      ) : row.vat === 'excluded' ? (
                        <span className="rounded-full bg-red-900/70 px-2 py-0.5 text-[11px] text-red-200">+ДДС</span>
                      ) : (
                        <span className="rounded-full bg-red-900/70 px-2 py-0.5 text-[11px] text-red-200">—</span>
                      )}
                    </td>

                    {/* капаро */}
                    <td className="px-3 py-2 text-center">
                      {row.kaparo ? (
                        <span className="rounded-full bg-orange-900/70 px-2 py-0.5 text-[11px] text-orange-200">
                          капаро
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>

                    {/* Last Edit */}
                    <td className="px-3 py-2 text-right text-xs text-gray-400">
                      {formatDate(row.last_edit)}
                    </td>

                    {/* Mileage */}
                    <td className="px-3 py-2 text-right text-gray-300">
                      {formatMileage(row.mileage)}
                    </td>

                    {/* Reg Year */}
                    <td className="px-3 py-2 text-right text-gray-300">
                      {row.reg_year ?? '—'}
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
