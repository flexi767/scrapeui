'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { ListingThumbPreview } from '@/components/ListingThumbPreview';
import { AdStatusBadge } from '@/components/listings/AdStatusBadge';
import { VatBadge } from '@/components/listings/VatBadge';
import {
  saveAdAsCarbrosDraft,
  setIgnoredSearchResult,
} from '@/components/mobile-bg-search-results/api';
import {
  formatMileageValue,
  formatRegMonthNumber,
  getDisplayTitle,
  truncateDealerLabel,
} from '@/components/mobile-bg-search-results/formatting';
import { errorMessage, formatCount, formatPrice } from '@/lib/utils';
import {
  getEffectiveSortPrice,
  getOriginalPositionIgnoring,
  getPriceSortedPositionIgnoring,
  sortRowsByEffectivePrice,
} from '@/lib/mobile-bg/search-ranking';
import { getVatBadgeLabel } from '@/lib/vat';
import type { MobileBgSearchResultRow } from '@/lib/mobile-bg/search-results';

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
  saveAdMode = false,
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
  saveAdMode?: boolean;
}) {
  const t = useTranslations('ui');
  const [ignoredResultIds, setIgnoredResultIds] = useState<string[]>(initialIgnoredResultIds ?? []);
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [savingDraftIds, setSavingDraftIds] = useState<Record<string, boolean>>({});
  const [savedDraftIds, setSavedDraftIds] = useState<Record<string, number>>({});

  const ignoredIdSet = useMemo(() => new Set(ignoredResultIds), [ignoredResultIds]);
  const sortedRows = sortRowsByEffectivePrice(rows);

  const matchedPosition = sourceMobileId ? getOriginalPositionIgnoring(rows, sourceMobileId, ignoredIdSet) : null;
  const matchedSortedPosition = sourceMobileId ? getPriceSortedPositionIgnoring(rows, sourceMobileId, ignoredIdSet) : null;
  const highestLoadedPage = loadedUntilPage != null && loadedUntilPage > page ? loadedUntilPage : page;

  async function toggleIgnored(mobileId: string, nextIgnored: boolean) {
    if (!sourceListingId || savingIds[mobileId]) return;
    setSavingIds((prev) => ({ ...prev, [mobileId]: true }));

    try {
      await setIgnoredSearchResult({ sourceListingId, mobileId, ignored: nextIgnored });
      setIgnoredResultIds((prev) => (
        nextIgnored ? [...new Set([...prev, mobileId])] : prev.filter((id) => id !== mobileId)
      ));
    } catch (error) {
      toast.error(errorMessage(error, t('failed_to_update_ignored_result')));
    } finally {
      setSavingIds((prev) => ({ ...prev, [mobileId]: false }));
    }
  }

  async function saveAdAsDraft(row: MobileBgSearchResultRow) {
    if (savingDraftIds[row.mobile_id]) return;
    setSavingDraftIds((prev) => ({ ...prev, [row.mobile_id]: true }));

    try {
      const backupId = await saveAdAsCarbrosDraft(row.url);
      setSavedDraftIds((prev) => ({ ...prev, [row.mobile_id]: backupId }));
      toast.success(t('saved_ad_as_carbros_draft'));
    } catch (error) {
      toast.error(errorMessage(error, t('failed_to_save_ad_as_draft')));
    } finally {
      setSavingDraftIds((prev) => ({ ...prev, [row.mobile_id]: false }));
    }
  }

  function renderDealerName(row: MobileBgSearchResultRow) {
    const fullLabel = row.dealer_name ?? 'Частно лице';
    const shortLabel = truncateDealerLabel(fullLabel);
    if (row.dealer_url) {
      return (
        <a href={row.dealer_url} target="_blank" rel="noreferrer" className="text-xs text-white hover:text-white" title={fullLabel}>
          {shortLabel}
        </a>
      );
    }
    return <span className="text-xs text-slate-200/80" title={fullLabel}>{shortLabel}</span>;
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
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-slate-500/60 bg-slate-700/70 text-xs font-medium uppercase tracking-wider text-slate-200/70">
              <th className="w-24 px-3 py-1.5 text-left">{t('col_img')}</th>
              <th className="px-3 py-1.5 text-right">{t('col_orig_num')}</th>
              <th className="px-2 py-1.5 text-left">{t('col_make_model')}</th>
              <th className="px-2 py-1.5 text-left">{t('col_title')}</th>
              <th className="px-2 py-1.5 text-left">{t('col_dealer')}</th>
              <th className="px-2 py-1.5 text-center w-14">{t('col_paid')}</th>
              <th className="pl-1 pr-3 py-1.5 text-right">{t('col_price')}</th>
              <th className="px-3 py-1.5 text-center">{t('col_vat')}</th>
              <th className="px-3 py-1.5 text-right">{t('col_year')}</th>
              <th className="px-3 py-1.5 text-right">{t('col_ps')}</th>
              <th className="px-3 py-1.5 text-center">{t('col_body_type')}</th>
              <th className="px-3 py-1.5 text-center">{t('col_fuel')}</th>
              <th className="px-3 py-1.5 text-right">{t('col_km')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-500/40">
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="py-10 text-center text-slate-200/60">
                  {t('no_mobilebg_results_found')}
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
                  <ListingThumbPreview
                    src={row.thumb}
                    href={row.url}
                    alt={`${row.make ?? 'Listing'} ${row.model ?? ''}`.trim() || 'Listing image'}
                    previewAlt={`${row.make ?? 'Listing'} ${row.model ?? ''}`.trim() || 'Listing image preview'}
                    placeholderClassName="h-10 w-14 rounded bg-slate-900"
                    fallbackLabel={t('missing')}
                  />
                </td>

                <td className="px-3 py-1 text-right text-slate-200/80">
                  <div className="flex items-center justify-end gap-2">
                    {saveAdMode ? (
                      <button
                        type="button"
                        onClick={() => void saveAdAsDraft(row)}
                        disabled={savingDraftIds[row.mobile_id] || savedDraftIds[row.mobile_id] != null}
                        className={`inline-flex h-5 w-5 items-center justify-center rounded border text-[11px] font-semibold leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          savedDraftIds[row.mobile_id] != null
                            ? 'border-emerald-500/60 bg-emerald-950/50 text-emerald-200'
                            : 'border-emerald-500/60 bg-emerald-950/30 text-emerald-200 hover:bg-emerald-900/60'
                        }`}
                        title={savedDraftIds[row.mobile_id] != null ? t('saved_as_draft') : t('save_ad_as_carbros_draft')}
                        aria-label={savedDraftIds[row.mobile_id] != null ? t('saved_as_draft') : t('save_ad_as_carbros_draft')}
                      >
                        {savingDraftIds[row.mobile_id] ? '…' : savedDraftIds[row.mobile_id] != null ? '✓' : '+'}
                      </button>
                    ) : !isSourceListing && (
                      <button
                        type="button"
                        onClick={() => void toggleIgnored(row.mobile_id, !isIgnored)}
                        disabled={!sourceListingId || savingIds[row.mobile_id]}
                        className={`inline-flex h-5 w-5 items-center justify-center rounded border text-[11px] font-semibold leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          isIgnored
                            ? 'border-amber-500/60 bg-amber-950/30 text-amber-200 hover:bg-amber-950/40'
                            : 'border-slate-500/60 bg-slate-900/40 text-slate-300 hover:bg-slate-700/60'
                        }`}
                        title={isIgnored ? t('unignore_result') : t('ignore_result')}
                        aria-label={isIgnored ? t('unignore_result') : t('ignore_result')}
                      >
                        {savingIds[row.mobile_id] ? '…' : '×'}
                      </button>
                    )}
                    <span>{row.original_position}</span>
                  </div>
                </td>

                <td className="px-2 py-1">
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

                <td className="max-w-[13rem] px-2 py-1">
                  <div>
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className={isSourceListing
                        ? 'line-clamp-2 text-xs font-semibold text-yellow-300 hover:text-yellow-200'
                        : 'line-clamp-2 text-xs text-white hover:text-white'}
                    >
                      {getDisplayTitle(row)}
                    </a>
                    {isIgnored && (
                      <div className="mt-1 text-[11px] uppercase tracking-wide text-amber-300/80">{t('ignored_for_ranking')}</div>
                    )}
                  </div>
                </td>

                <td className="w-28 px-2 py-1">
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

                <td className="px-3 py-1 text-right text-xs text-slate-200/80">
                  <div>{formatRegMonthNumber(row.reg_month)}</div>
                  <div>{row.reg_year ?? '—'}</div>
                </td>

                <td className="px-3 py-1 text-right text-xs text-slate-200/80">
                  {formatCount(row.power)}
                </td>

                <td className="px-3 py-1 text-center">
                  <span className="text-xs text-slate-200/80">{row.body_type ?? '—'}</span>
                </td>

                <td className="px-3 py-1 text-center">
                  <span className="text-xs text-slate-200/80">{row.fuel ?? '—'}</span>
                </td>

                <td className="px-3 py-1 text-right text-xs text-slate-200/80">
                  {formatMileageValue(row.mileage)}
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
