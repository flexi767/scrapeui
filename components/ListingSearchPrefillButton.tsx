'use client';

import { useState } from 'react';
import { SearchIcon, SearchCheckIcon } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MobileBgSearchResultsTable } from '@/components/MobileBgSearchResultsTable';
import { SearchPrefillFields } from '@/components/search-prefill/SearchPrefillFields';
import {
  ErrorPanel,
  FallbackNotePanel,
  ListingSummaryPanel,
  LoadingPanel,
  MessagesPanel,
} from '@/components/listing-search-prefill/DialogPanels';
import { DialogActions } from '@/components/listing-search-prefill/DialogActions';
import { useListingSearchPrefill } from '@/components/listing-search-prefill/useListingSearchPrefill';
import { useTranslations } from 'next-intl';

export default function ListingSearchPrefillButton({
  listingId,
  showQuickResultsButton = true,
}: {
  listingId: number;
  showQuickResultsButton?: boolean;
}) {
  const t = useTranslations('ui');
  const [open, setOpen] = useState(false);
  const searchPrefill = useListingSearchPrefill(listingId);
  const {
    data,
    editableFields,
    error,
    filtersVisible,
    loading,
    locationLoading,
    profileSaving,
    results,
    resultsError,
    resultsLoading,
    subLocationLabel,
    subLocationOptions,
    buildFirstSevenFields,
    buildSubmissionFields,
    clearField,
    getFieldValue,
    load,
    nudgeField,
    resetSearchProfile,
    saveSearchProfile,
    showFilters,
    showResultsHere,
    submitToMobileBg,
    updateField,
    updateLocation,
    updateMake,
  } = searchPrefill;

  function openAndLoad(action: 'open' | 'show-first-7') {
    setOpen(true);
    void load(action);
  }

  return (
    <>
      <div className="flex flex-col items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          className="border-gray-600 bg-gray-900/80 text-gray-200 hover:bg-gray-800 hover:text-white"
          onClick={() => openAndLoad('open')}
          aria-label={t('show_prefilled_search_fields')}
        >
          <SearchIcon />
        </Button>
        {showQuickResultsButton && (
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            className="border-sky-700 bg-sky-950/80 text-sky-200 hover:bg-sky-900 hover:text-white"
            onClick={() => openAndLoad('show-first-7')}
            aria-label={t('show_quick_results')}
          >
            <SearchCheckIcon />
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="h-[min(94vh,1100px)] w-[min(98vw,1680px)] max-w-[min(98vw,1680px)] sm:h-[min(94vh,1100px)] sm:w-[min(98vw,1680px)] sm:max-w-[min(98vw,1680px)] overflow-hidden border border-slate-500 bg-slate-700 text-white shadow-2xl" showCloseButton>
          {loading && (
            <LoadingPanel label={t('loading_search_fields')} />
          )}

          <ErrorPanel message={error} />

          {data && !loading && !error && (
            <div className="flex min-h-0 flex-1 flex-col space-y-4">
              <ListingSummaryPanel data={data} />

              {filtersVisible && (
                <div className="rounded-lg border border-slate-500/70 bg-slate-800/85">
                  <div className="max-h-[32rem] overflow-y-auto px-4 py-3">
                    <SearchPrefillFields
                      fields={editableFields}
                      makes={data.options.makes}
                      modelsByMake={data.options.modelsByMake}
                      locations={data.options.locations}
                      subLocationLabel={subLocationLabel}
                      subLocationOptions={subLocationOptions}
                      locationLoading={locationLoading}
                      getFieldValue={getFieldValue}
                      onClear={clearField}
                      onNudge={nudgeField}
                      onUpdateField={updateField}
                      onUpdateLocation={updateLocation}
                      onUpdateMake={updateMake}
                    />
                  </div>
                </div>
              )}

              <MessagesPanel messages={data.omitted} />

              {resultsLoading && (
                <LoadingPanel label={t('loading_results')} />
              )}

              <ErrorPanel message={resultsError} />

              {results && !resultsLoading && !resultsError && (
                <div className="min-h-0 flex-1 space-y-3">
                  <FallbackNotePanel message={results.fallback_note} />
                  <MobileBgSearchResultsTable
                    rows={results.rows}
                    summaryText={results.summary_text}
                    page={results.page}
                    totalPages={results.total_pages}
                    hasNextPage={results.has_next_page}
                    loadedUntilPage={results.loaded_until_page}
                    sourceListingId={listingId}
                    initialIgnoredResultIds={results.ignored_search_result_ids ?? []}
                    sourceMobileId={data.listing.mobile_id}
                  />
                </div>
              )}
            </div>
          )}

          <DialogActions
            filtersVisible={filtersVisible}
            hasData={Boolean(data)}
            hasError={Boolean(error)}
            loading={loading}
            profileSaving={profileSaving}
            resultsLoading={resultsLoading}
            savedSearchEnabled={Boolean(data?.savedSearch.enabled)}
            onClose={() => setOpen(false)}
            onResetSearchProfile={() => void resetSearchProfile()}
            onSaveSearchProfile={() => void saveSearchProfile()}
            onShowAllResults={() => showResultsHere(buildSubmissionFields())}
            onShowFilters={showFilters}
            onShowFirstSevenResults={() => showResultsHere(buildFirstSevenFields())}
            onSubmitAll={() => submitToMobileBg(buildSubmissionFields())}
            onSubmitFirstSeven={() => submitToMobileBg(buildFirstSevenFields())}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
