'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { SearchIcon, SearchCheckIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MobileBgSearchResultsTable } from '@/components/MobileBgSearchResultsTable';
import { SearchPrefillFields } from '@/components/search-prefill/SearchPrefillFields';
import {
  loadLocationOptions,
  loadMobileBgSearchResults,
  loadSearchPrefill,
  resetSearchProfileFields,
  saveSearchProfileFields,
} from '@/components/listing-search-prefill/api';
import type {
  MobileBgSearchResultsResponse,
  PendingAction,
  SearchField,
  SearchPrefillResponse,
} from '@/components/listing-search-prefill/types';
import {
  MOBILE_BG_ALWAYS_INCLUDED_FIELD_NAMES as ALWAYS_INCLUDED_FIELD_NAMES,
  MOBILE_BG_HIDDEN_FIELD_NAMES as HIDDEN_FIELD_NAMES,
} from '@/lib/mobile-bg/search-field-config';

export default function ListingSearchPrefillButton({
  listingId,
  showQuickResultsButton = true,
}: {
  listingId: number;
  showQuickResultsButton?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<SearchPrefillResponse | null>(null);
  const [editableFields, setEditableFields] = useState<SearchField[]>([]);
  const [subLocationLabel, setSubLocationLabel] = useState('Населено място');
  const [subLocationOptions, setSubLocationOptions] = useState<Array<{ value: string; label: string }>>([{ value: '', label: 'всички' }]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState('');
  const [results, setResults] = useState<MobileBgSearchResultsResponse | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  function syncEditableFields(nextData: SearchPrefillResponse) {
    setEditableFields(nextData.form.fields.map((field) => ({ ...field })));
    setSubLocationLabel(nextData.options.subLocations.label);
    setSubLocationOptions(nextData.options.subLocations.options);
  }

  async function saveSearchProfile() {
    setProfileSaving(true);
    try {
      const fields = buildSubmissionFields();
      await saveSearchProfileFields(listingId, fields);
      const nextData = await loadSearchPrefill(listingId);
      setData(nextData);
      syncEditableFields(nextData);
      toast.success('Saved custom search values');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save search values');
    } finally {
      setProfileSaving(false);
    }
  }

  async function resetSearchProfile() {
    setProfileSaving(true);
    try {
      await resetSearchProfileFields(listingId);
      const nextData = await loadSearchPrefill(listingId);
      setData(nextData);
      syncEditableFields(nextData);
      toast.success('Reset to default search values');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset saved search values');
    } finally {
      setProfileSaving(false);
    }
  }

  async function load(action: PendingAction = 'open') {
    if (data || loading) {
      if (action) setPendingAction(action);
      if (action === 'open') setFiltersVisible(true);
      setOpen(true);
      return;
    }
    setLoading(true);
    setError('');
    if (action) setPendingAction(action);
    if (action === 'open') setFiltersVisible(true);
    setOpen(true);

    try {
      const nextData = await loadSearchPrefill(listingId);
      setData(nextData);
      syncEditableFields(nextData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load search fields');
    } finally {
      setLoading(false);
    }
  }

  const runPendingAction = useEffectEvent(async (action: PendingAction) => {
    if (action === 'show-first-7') {
      await showResultsHere(buildFirstSevenFields());
    }
  });

  useEffect(() => {
    if (!data || loading || resultsLoading || pendingAction == null) return;
    if (pendingAction === 'show-first-7') void runPendingAction(pendingAction);
    setPendingAction(null);
  }, [data, loading, pendingAction, resultsLoading]);

  function updateField(name: string, value: string) {
    setEditableFields((prev) => prev.map((field) => (
      field.name === name ? { ...field, value } : field
    )));
  }

  function getFieldValue(name: string) {
    return editableFields.find((field) => field.name === name)?.value ?? '';
  }

  function updateMake(value: string) {
    setEditableFields((prev) => {
      const next = prev.map((field) => (
        field.name === 'marka' ? { ...field, value } : field
      ));
      const validModels = data?.options.modelsByMake[value] ?? [];
      const currentModel = next.find((field) => field.name === 'model')?.value ?? '';
      if (currentModel && !validModels.some((option) => option.value === currentModel)) {
        return next.map((field) => (
          field.name === 'model' ? { ...field, value: '' } : field
        ));
      }
      return next;
    });
  }

  async function updateLocation(value: string) {
    updateField('f17', value);
    setLocationLoading(true);
    setSubLocationLabel('Населено място');
    setSubLocationOptions([{ value: '', label: 'всички' }]);
    setEditableFields((prev) => prev.map((field) => {
      if (field.name === 'f17') return { ...field, value };
      if (field.name === 'f18') return { ...field, value: '', label: 'Населено място', source: 'default' };
      return field;
    }));

    try {
      const payload = await loadLocationOptions(value);
      const nextLabel = typeof payload.label === 'string' && payload.label ? payload.label : 'Населено място';
      const nextOptions = Array.isArray(payload.options) && payload.options.length > 0
        ? payload.options as Array<{ value: string; label: string }>
        : [{ value: '', label: 'всички' }];

      setSubLocationLabel(nextLabel);
      setSubLocationOptions(nextOptions);
      setEditableFields((prev) => prev.map((field) => (
        field.name === 'f18' ? { ...field, label: nextLabel, value: '' } : field
      )));
    } catch {
      // Keep the safe default dropdown if the lookup fails.
    } finally {
      setLocationLoading(false);
    }
  }

  function nudgeField(name: string, delta: number) {
    setEditableFields((prev) => prev.map((field) => {
      if (field.name !== name) return field;
      const parsed = Number.parseInt(field.value || '0', 10);
      const base = Number.isFinite(parsed) ? parsed : 0;
      return { ...field, value: String(base + delta) };
    }));
  }

  function clearField(name: string) {
    updateField(name, '');
  }

  function buildSubmissionFields() {
    if (!data) return [];
    return data.form.fields.map((field) => {
      const edited = editableFields.find((candidate) => candidate.name === field.name);
      return edited ?? field;
    });
  }

  function buildFirstSevenFields() {
    const submissionFields = buildSubmissionFields();
    const hiddenFields = submissionFields.filter((field) => HIDDEN_FIELD_NAMES.has(field.name));
    const alwaysIncludedFields = submissionFields.filter((field) => ALWAYS_INCLUDED_FIELD_NAMES.has(field.name));
    const firstSevenVisibleFields = submissionFields
      .filter((field) => !HIDDEN_FIELD_NAMES.has(field.name) && !ALWAYS_INCLUDED_FIELD_NAMES.has(field.name))
      .slice(0, 7);
    return [...hiddenFields, ...alwaysIncludedFields, ...firstSevenVisibleFields];
  }

  function submitToMobileBg(fields = buildSubmissionFields()) {
    if (!data || typeof document === 'undefined') return;
    const form = document.createElement('form');
    form.method = data.form.method;
    form.action = data.form.action;
    form.target = '_blank';
    form.acceptCharset = 'windows-1251';

    for (const field of fields) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = field.name;
      input.value = field.value;
      form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
    form.remove();
  }

  function showFilters() {
    setFiltersVisible(true);
    setResults(null);
    setResultsError('');
    setResultsLoading(false);
  }

  async function showResultsHere(fields = buildSubmissionFields()) {
    if (!data) return;
    setFiltersVisible(false);
    setResultsLoading(true);
    setResultsError('');

    try {
      const payload = await loadMobileBgSearchResults({
        action: data.form.action,
        method: data.form.method,
        fields,
        sourceListingId: listingId,
        sourceMobileId: data.listing.mobile_id,
      });
      setResults(payload);
    } catch (err: unknown) {
      setResultsError(err instanceof Error ? err.message : 'Failed to load mobile.bg results');
      setResults(null);
    } finally {
      setResultsLoading(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          className="border-gray-600 bg-gray-900/80 text-gray-200 hover:bg-gray-800 hover:text-white"
          onClick={() => void load('open')}
          aria-label="Show prefilled mobile.bg search fields"
        >
          <SearchIcon />
        </Button>
        {showQuickResultsButton && (
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            className="border-sky-700 bg-sky-950/80 text-sky-200 hover:bg-sky-900 hover:text-white"
            onClick={() => void load('show-first-7')}
            aria-label="Show mobile.bg results for first 7 filters"
          >
            <SearchCheckIcon />
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="h-[min(94vh,1100px)] w-[min(98vw,1680px)] max-w-[min(98vw,1680px)] sm:h-[min(94vh,1100px)] sm:w-[min(98vw,1680px)] sm:max-w-[min(98vw,1680px)] overflow-hidden border border-slate-500 bg-slate-700 text-white shadow-2xl" showCloseButton>
          {loading && (
            <div className="rounded-lg border border-slate-500/70 bg-slate-800/80 px-4 py-8 text-center text-sm text-slate-100/85">
              <div className="flex items-center justify-center gap-3">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-sky-300" />
                <span>Loading mobile.bg search fields…</span>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-700/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {data && !loading && !error && (
            <div className="flex min-h-0 flex-1 flex-col space-y-4">
              <div className="rounded-lg border border-slate-500/70 bg-slate-800/85 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <div className="font-medium text-white">
                    {[data.listing.make, data.listing.model].filter(Boolean).join(' ') || 'Listing'}
                  </div>
                  {data.listing.mobile_id && (
                    <div className="rounded-full border border-sky-500/40 bg-sky-950/40 px-2 py-0.5 text-[11px] font-medium text-sky-200">
                      {data.listing.mobile_id}
                    </div>
                  )}
                  {data.listing.title && (
                    <div className="text-xs text-slate-100/75">
                      {data.listing.title}
                    </div>
                  )}
                </div>
                <div className="mt-1 text-xs text-slate-100/75">
                  {data.reference.makeCount != null ? `${data.reference.makeCount.toLocaleString('en-US')} listings for make` : 'No make count in reference data'}
                  {data.reference.modelCount != null ? ` • ${data.reference.modelCount.toLocaleString('en-US')} for model` : ''}
                </div>
                <div className="mt-1 text-xs text-slate-100/65">
                  {data.savedSearch.enabled
                    ? `Using saved custom search values${data.savedSearch.updatedAt ? ` • updated ${data.savedSearch.updatedAt}` : ''}`
                    : 'Using generated default search values'}
                </div>
              </div>

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

              {data.omitted.length > 0 && (
                <div className="rounded-lg border border-amber-700/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
                  {data.omitted.map((message, index) => (
                    <div key={`${message}-${index}`}>{message}</div>
                  ))}
                </div>
              )}

              {resultsLoading && (
                <div className="rounded-lg border border-slate-500/70 bg-slate-800/80 px-4 py-8 text-center text-sm text-slate-100/85">
                  <div className="flex items-center justify-center gap-3">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-500 border-t-sky-300" />
                    <span>Loading mobile.bg results…</span>
                  </div>
                </div>
              )}

              {resultsError && (
                <div className="rounded-lg border border-red-700/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                  {resultsError}
                </div>
              )}

              {results && !resultsLoading && !resultsError && (
                <div className="min-h-0 flex-1 space-y-3">
                  {results.fallback_note && (
                    <div className="rounded-lg border border-amber-700/30 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
                      {results.fallback_note}
                    </div>
                  )}
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

          <DialogFooter className="border-slate-500/60 bg-slate-800/85">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            {!filtersVisible && (
              <Button variant="outline" onClick={showFilters}>
                Show filters
              </Button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" onClick={() => void saveSearchProfile()} disabled={!data || loading || profileSaving || Boolean(error)}>
                {profileSaving ? 'Saving…' : 'Save search values'}
              </Button>
              <Button variant="outline" onClick={() => void resetSearchProfile()} disabled={!data || loading || profileSaving || Boolean(error) || !data.savedSearch.enabled}>
                Reset saved
              </Button>
              <Button onClick={() => submitToMobileBg(buildSubmissionFields())} disabled={!data || loading || Boolean(error)}>
                Submit all
              </Button>
              <Button onClick={() => submitToMobileBg(buildFirstSevenFields())} disabled={!data || loading || Boolean(error)}>
                Submit first 7
              </Button>
              <Button onClick={() => showResultsHere(buildSubmissionFields())} disabled={!data || loading || Boolean(error) || resultsLoading}>
                Show results for all filters
              </Button>
              <Button onClick={() => showResultsHere(buildFirstSevenFields())} disabled={!data || loading || Boolean(error) || resultsLoading}>
                Show results for first 7 filters
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
