'use client';

import { useMemo, useState } from 'react';
import { ImageWithFallback } from '@/components/ImageWithFallback';
import { formatMileage, formatPrice } from '@/lib/utils';
import {
  getEffectiveSortPrice,
  getOriginalPositionIgnoring,
  getPriceSortedPositionIgnoring,
  sortRowsByEffectivePrice,
} from '@/lib/mobile-bg/search-ranking';
import { getVatBadgeLabel } from '@/lib/vat';
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

function truncateDealerLabel(value: string, maxLength = 20) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function getDisplayTitle(row: MobileBgSearchResultRow) {
  const title = row.title.trim();
  const make = row.make?.trim();
  const model = row.model?.trim();
  const combined = [make, model].filter(Boolean).join(' ').trim();

  if (combined) {
    const escapedCombined = combined.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const withoutCombined = title.replace(new RegExp(`^${escapedCombined}(?:\\s+|/|$)`, 'iu'), '').trim();
    if (withoutCombined) return withoutCombined.replace(/^\/+/, '').trim();
  }

  if (make) {
    const escapedMake = make.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const withoutMake = title.replace(new RegExp(`^${escapedMake}(?:\\s+|/|$)`, 'iu'), '').trim();
    if (withoutMake) return withoutMake.replace(/^\/+/, '').trim();
  }

  return title;
}

function VatBadge({ vat }: { vat: MobileBgSearchResultRow['vat_status'] }) {
  if (vat === 'included') {
    return <span className="rounded-full bg-blue-900/70 px-2 py-0.5 text-[11px] text-blue-200">има</span>;
  }
  if (vat === 'exempt') {
    return <span className="rounded-full bg-green-900/70 px-2 py-0.5 text-[11px] text-green-200">няма</span>;
  }
  if (vat === 'excluded') {
    return <span className="rounded-full bg-red-900/70 px-2 py-0.5 text-[11px] text-red-200">+ДДС</span>;
  }
  return <span className="text-gray-600">—</span>;
}

export function MobileBgSearchResultsTable({
  rows,
  summaryText,
  page,
  totalPages,
  hasNextPage,
  loadedUntilPage,
  sourceListingId,
  initialIgnoredResultIds,
  sourceMobileId,
}: {
  rows: MobileBgSearchResultRow[];
  summaryText: string | null;
  page: number;
  totalPages: number | null;
  hasNextPage: boolean;
  loadedUntilPage?: number | null;
  sourceListingId?: number | null;
  initialIgnoredResultIds?: string[];
  sourceMobileId: string | null;
}) {
  const [ignoredResultIds, setIgnoredResultIds] = useState<string[]>(initialIgnoredResultIds ?? []);
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});

  const ignoredIdSet = useMemo(() => new Set(ignoredResultIds), [ignoredResultIds]);
  const sortedRows = sortRowsByEffectivePrice(rows);

  const matchedPosition = sourceMobileId ? getOriginalPositionIgnoring(rows, sourceMobileId, ignoredIdSet) : null;
  const matchedSortedPosition = sourceMobileId ? getPriceSortedPositionIgnoring(rows, sourceMobileId, ignoredIdSet) : null;
  const highestLoadedPage = loadedUntilPage != null && loadedUntilPage > page ? loadedUntilPage : page;

  async function toggleIgnored(mobileId: string, nextIgnored: boolean) {
    if (!sourceListingId || savingIds[mobileId]) return;
    setSavingIds((prev) => ({ ...prev, [mobileId]: true }));

    try {
      const res = await fetch(`/api/listings/by-id/${sourceListingId}/ignored-search-results`, {
        method: nextIgnored ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ignoredMobileId: mobileId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((payload as { error?: string }).error || 'Failed to update ignored search result');
      }

      setIgnoredResultIds((prev) => (
        nextIgnored ? [...new Set([...prev, mobileId])] : prev.filter((id) => id !== mobileId)
      ));
    } catch (error) {
      console.error(error);
    } finally {
      setSavingIds((prev) => ({ ...prev, [mobileId]: false }));
    }
  }

  function renderDealerName(row: MobileBgSearchResultRow) {
    const fullLabel = row.dealer_name ?? 'Частно лице';
    const shortLabel = truncateDealerLabel(fullLabel);
    if (row.dealer_url) {
      return (
        <a href={row.dealer_url} target="_blank" rel="noreferrer" className="text-white hover:text-white" title={fullLabel}>
          {shortLabel}
        </a>
      );
    }
    return <span className="text-slate-200/80" title={fullLabel}>{shortLabel}</span>;
  }

  return (
    <div className="rounded-lg border border-slate-500/70 bg-slate-800/85">
      <div className="border-b border-slate-500/60 px-4 py-3">
        {sourceMobileId && (
          <div className="mt-1 text-xs text-sky-200/90">
            {matchedPosition
              ? `Source listing ${sourceMobileId} is at original position ${matchedPosition}${matchedSortedPosition ? ` and local price-sort position ${matchedSortedPosition}` : ''} on this results page`
              : `Source listing ${sourceMobileId} is not on this results page`}
          </div>
        )}
        {summaryText && (
          <div className="mt-1 text-xs text-slate-200/75">
            {summaryText}
          </div>
        )}
        <div className="mt-1 text-xs text-slate-200/60">
          {rows.length > 0
            ? `Showing ${rows.length} result${rows.length === 1 ? '' : 's'} from the current mobile.bg search, displayed locally by effective price`
            : 'No results returned for the current mobile.bg search'}
        </div>
        <div className="mt-1 text-xs text-slate-200/60">
          {highestLoadedPage > page
            ? `Pages ${page}-${highestLoadedPage}${totalPages ? ` of ${totalPages}` : ''}${hasNextPage ? ' • more pages available' : ''}`
            : `Page ${page}${totalPages ? ` of ${totalPages}` : ''}${hasNextPage ? ' • more pages available' : ''}`}
        </div>
      </div>

      <div className="mobile-bg-results-scroll max-h-[600px] overflow-x-auto overflow-y-auto rounded-b-lg">
        <table className="w-full min-w-[1180px] text-sm">
          <thead>
            <tr className="border-b border-slate-500/60 bg-slate-700/70 text-xs font-medium uppercase tracking-wider text-slate-200/70">
              <th className="w-24 px-3 py-1.5 text-left">Img</th>
              <th className="px-3 py-1.5 text-right">Orig #</th>
              <th className="px-3 py-1.5 text-left">Make / Model</th>
              <th className="px-3 py-1.5 text-left">Title</th>
              <th className="px-3 py-1.5 text-left">Dealer</th>
              <th className="px-2 py-1.5 text-center w-14">Paid</th>
              <th className="pl-1 pr-3 py-1.5 text-right">Price</th>
              <th className="px-3 py-1.5 text-center">VAT</th>
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
                <td colSpan={13} className="py-10 text-center text-slate-200/60">
                  No mobile.bg results found.
                </td>
              </tr>
            )}

            {sortedRows.map((row, index) => {
              const isSourceListing = sourceMobileId != null && row.mobile_id === sourceMobileId;
              const isIgnored = ignoredIdSet.has(row.mobile_id);
              const effectiveSortedPosition = getPriceSortedPositionIgnoring(rows, row.mobile_id, ignoredIdSet);
              return (
              <tr
                key={`${row.mobile_id}-${row.url}`}
                className={isSourceListing
                  ? 'border-l-4 border-l-sky-400 bg-sky-950/35 transition-colors hover:bg-sky-900/35'
                  : isIgnored
                  ? 'bg-slate-900/60 opacity-65 transition-colors hover:bg-slate-800/60'
                  : 'transition-colors hover:bg-slate-700/50'}
              >
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
                          fallbackClassName="w-full rounded bg-slate-900 text-slate-300 shadow-xl"
                          fallbackLabel="Missing"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="h-10 w-14 rounded bg-slate-900" />
                  )}
                </td>

                <td className="px-3 py-1 text-right text-slate-200/80">
                  <div className="flex items-center justify-end gap-2">
                    {!isSourceListing && (
                      <button
                        type="button"
                        onClick={() => void toggleIgnored(row.mobile_id, !isIgnored)}
                        disabled={!sourceListingId || savingIds[row.mobile_id]}
                        className={`inline-flex h-5 w-5 items-center justify-center rounded border text-[11px] font-semibold leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          isIgnored
                            ? 'border-amber-500/60 bg-amber-950/30 text-amber-200 hover:bg-amber-950/40'
                            : 'border-slate-500/60 bg-slate-900/40 text-slate-300 hover:bg-slate-700/60'
                        }`}
                        title={isIgnored ? 'Unignore result' : 'Ignore result'}
                        aria-label={isIgnored ? 'Unignore result' : 'Ignore result'}
                      >
                        {savingIds[row.mobile_id] ? '…' : '×'}
                      </button>
                    )}
                    <span>{row.original_position}</span>
                  </div>
                </td>

                <td className="px-3 py-1">
                  <div className="flex items-center gap-2 font-medium text-white">
                    <span>{row.make || '—'}</span>
                    {isSourceListing && (
                      <span className="rounded-full border border-sky-400/60 bg-sky-950/70 px-2 py-0.5 text-[11px] font-semibold text-sky-200">
                        #{effectiveSortedPosition ?? index + 1}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-200/65">{row.model || '—'}</div>
                </td>

                <td className="max-w-xs px-3 py-1">
                  <div>
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className={isSourceListing
                        ? 'line-clamp-2 font-semibold text-yellow-300 hover:text-yellow-200'
                        : 'line-clamp-2 text-white hover:text-white'}
                    >
                      {getDisplayTitle(row)}
                    </a>
                    {isIgnored && (
                      <div className="mt-1 text-[11px] uppercase tracking-wide text-amber-300/80">Ignored for ranking</div>
                    )}
                  </div>
                </td>

                <td className="px-3 py-1">
                  {renderDealerName(row)}
                </td>

                <td className="px-2 py-1 text-center">
                  <AdStatusBadge status={row.ad_status} />
                </td>

                <td className="pl-1 pr-3 py-1 text-right">
                  <div className="font-semibold text-green-400">
                    {formatPrice(row.current_price)}
                  </div>
                  {row.vat_status === 'excluded' && getEffectiveSortPrice(row) != null && (
                    <div className="text-xs text-emerald-200/85">
                      {formatPrice(getEffectiveSortPrice(row))}
                    </div>
                  )}
                </td>

                <td
                  className="px-3 py-1 text-center text-xs text-slate-200/80"
                  title={row.vat_status === 'excluded' && row.current_price != null
                    ? `${getVatBadgeLabel(row.vat_status)} • sorts as ${formatPrice(getEffectiveSortPrice(row))}`
                    : undefined}
                >
                  <VatBadge vat={row.vat_status} />
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
            );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
