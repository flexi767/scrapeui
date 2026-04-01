'use client';

import { ImageWithFallback } from '@/components/ImageWithFallback';
import { formatMileage, formatPrice } from '@/lib/utils';
import type { MobileBgSearchResultRow } from '@/lib/mobile-bg/search-results';

function AdStatusBadge({ status }: { status: string }) {
  if (!status || status === 'none') {
    return <span className="text-gray-600">—</span>;
  }
  if (status.toUpperCase() === 'TOP') {
    return <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: '#1a6496' }}>TOP</span>;
  }
  if (status.toUpperCase() === 'VIP') {
    return <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: '#c0392b' }}>VIP</span>;
  }
  return <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[11px] text-gray-300">{status}</span>;
}

export function MobileBgSearchResultsTable({
  rows,
  summaryText,
  page,
  totalPages,
  hasNextPage,
}: {
  rows: MobileBgSearchResultRow[];
  summaryText: string | null;
  page: number;
  totalPages: number | null;
  hasNextPage: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-500/70 bg-slate-800/85">
      <div className="border-b border-slate-500/60 px-4 py-3">
        <div className="text-sm font-medium text-white">Mobile.bg search results</div>
        <div className="mt-1 text-xs text-slate-200/75">
          {summaryText || 'First page of mobile.bg search results'}
        </div>
        <div className="mt-1 text-xs text-slate-200/60">
          Page {page}{totalPages ? ` of ${totalPages}` : ''}{hasNextPage ? ' • more pages available' : ''}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-500/60 bg-slate-700/70 text-xs font-medium uppercase tracking-wider text-slate-200/70">
              <th className="w-24 px-3 py-1.5 text-left">Img</th>
              <th className="px-3 py-1.5 text-left">Make / Model</th>
              <th className="px-3 py-1.5 text-left">Title</th>
              <th className="px-3 py-1.5 text-left">Dealer</th>
              <th className="px-2 py-1.5 text-center w-14">Paid</th>
              <th className="pl-1 pr-3 py-1.5 text-right">Price</th>
              <th className="px-3 py-1.5 text-right">Month</th>
              <th className="px-3 py-1.5 text-right">Year</th>
              <th className="px-3 py-1.5 text-center">Body Type</th>
              <th className="px-3 py-1.5 text-center">Fuel</th>
              <th className="px-3 py-1.5 text-right">KM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-500/40">
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="py-10 text-center text-slate-200/60">
                  No mobile.bg results found.
                </td>
              </tr>
            )}

            {rows.map((row) => (
              <tr key={`${row.mobile_id}-${row.url}`} className="transition-colors hover:bg-slate-700/50">
                <td className="px-3 py-1">
                  {row.thumb ? (
                    <div className="relative inline-block w-16">
                      <a href={row.url} target="_blank" rel="noreferrer" className="peer block">
                        <ImageWithFallback
                          src={row.thumb}
                          alt={`${row.make ?? 'Listing'} ${row.model ?? ''}`.trim() || 'Listing image'}
                          className="w-16 rounded object-contain"
                          style={{ aspectRatio: '4/3' }}
                          fallbackClassName="w-16 rounded bg-slate-900 text-slate-300"
                          fallbackLabel="Missing"
                        />
                      </a>
                      <div className="pointer-events-none absolute left-full top-0 z-50 ml-2 hidden w-64 peer-hover:block">
                        <ImageWithFallback
                          src={row.thumb}
                          alt={`${row.make ?? 'Listing'} ${row.model ?? ''}`.trim() || 'Listing image preview'}
                          className="w-full rounded shadow-xl"
                          style={{ aspectRatio: '4/3' }}
                          fallbackClassName="w-full rounded bg-slate-900 text-slate-300 shadow-xl"
                          fallbackLabel="Missing"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="h-10 w-14 rounded bg-slate-900" />
                  )}
                </td>

                <td className="px-3 py-1">
                  <div className="font-medium text-white">{row.make || '—'}</div>
                  <div className="text-xs text-slate-200/65">{row.model || '—'}</div>
                </td>

                <td className="max-w-xs px-3 py-1">
                  <a href={row.url} target="_blank" rel="noreferrer" className="line-clamp-2 text-white hover:text-white">
                    {row.title}
                  </a>
                </td>

                <td className="px-3 py-1">
                  {row.dealer_url ? (
                    <a href={row.dealer_url} target="_blank" rel="noreferrer" className="text-white hover:text-white">
                      {row.dealer_name ?? '—'}
                    </a>
                  ) : (
                    <span className="text-slate-200/80">{row.dealer_name ?? '—'}</span>
                  )}
                </td>

                <td className="px-2 py-1 text-center">
                  <AdStatusBadge status={row.ad_status} />
                </td>

                <td className="pl-1 pr-3 py-1 text-right font-semibold text-green-400">
                  {formatPrice(row.current_price)}
                </td>

                <td className="px-3 py-1 text-right text-slate-200/80">
                  {row.reg_month ?? '—'}
                </td>

                <td className="px-3 py-1 text-right text-slate-200/80">
                  {row.reg_year ?? '—'}
                </td>

                <td className="px-3 py-1 text-center">
                  <span className="text-xs text-slate-200/80">{row.body_type ?? '—'}</span>
                </td>

                <td className="px-3 py-1 text-center">
                  <span className="text-xs text-slate-200/80">{row.fuel ?? '—'}</span>
                </td>

                <td className="px-3 py-1 text-right text-slate-200/80">
                  {formatMileage(row.mileage)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
