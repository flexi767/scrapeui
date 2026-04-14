'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { SearchIcon, SearchCheckIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MobileBgSearchResultsTable } from '@/components/MobileBgSearchResultsTable';
import type { MobileBgSearchResultsPayload } from '@/lib/mobile-bg/search-results';

interface SearchField {
  name: string;
  label: string;
  value: string;
  source: 'default' | 'listing' | 'derived' | 'saved';
}

interface SearchPrefillResponse {
  listing: {
    id: number;
    mobile_id: string | null;
    title: string | null;
    make: string | null;
    model: string | null;
    currentPrice: number | null;
  };
  form: {
    action: string;
    method: 'POST';
    fields: SearchField[];
    visibleFields: SearchField[];
  };
  reference: {
    makeCount: number | null;
    modelCount: number | null;
  };
  options: {
    makes: Array<{ value: string; count: number | null }>;
    modelsByMake: Record<string, Array<{ value: string; count: number | null }>>;
    locations: Array<{ value: string; label: string }>;
    subLocations: {
      label: string;
      options: Array<{ value: string; label: string }>;
    };
  };
  omitted: string[];
  savedSearch: {
    enabled: boolean;
    updatedAt: string | null;
  };
}

interface MobileBgSearchResultsResponse extends MobileBgSearchResultsPayload {
  fallback_note?: string | null;
}

const HIDDEN_FIELD_NAMES = new Set(['topmenu', 'rub', 'act', 'rub_pub_save', 'pubtype', 'f20', 'f9']);
const ALWAYS_INCLUDED_FIELD_NAMES = new Set(['f17']);
const ENGINE_OPTIONS = ['', 'Бензинов', 'Дизелов', 'Електрически', 'Хибриден', 'Plug-in хибрид', 'Газ', 'Водород'];
const TRANSMISSION_OPTIONS = ['', 'Ръчна', 'Автоматична', 'Полуавтоматична'];
const CATEGORY_OPTIONS = ['', 'Ван', 'Джип', 'Кабрио', 'Комби', 'Купе', 'Миниван', 'Пикап', 'Седан', 'Стреч лимузина', 'Хечбек'];
const STEPPER_FIELDS = new Set(['f10', 'f11', 'f25', 'f26']);
const CLEARABLE_FIELDS = new Set(['f25', 'f26', 'f7', 'f8', 'f15']);

function normalizeOptionValue(value: string) {
  return value.trim().toLowerCase();
}

function getSelectedOptionCount(
  options: Array<{ value: string; count?: number | null }>,
  value: string,
) {
  const normalizedValue = normalizeOptionValue(value);
  if (!normalizedValue) return null;
  const match = options.find(
    (option) => normalizeOptionValue(option.value) === normalizedValue,
  );
  return match?.count ?? null;
}

type PendingAction = 'open' | 'show-first-7' | null;

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
      const res = await fetch(`/api/listing-search-profiles/${listingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((payload as { error?: string }).error || 'Failed to save search values');
      }

      const refresh = await fetch(`/api/listings/search-prefill/${listingId}`);
      const refreshPayload = await refresh.json().catch(() => ({}));
      if (!refresh.ok) {
        throw new Error((refreshPayload as { error?: string }).error || 'Failed to reload saved search values');
      }

      const nextData = refreshPayload as SearchPrefillResponse;
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
      const res = await fetch(`/api/listing-search-profiles/${listingId}`, {
        method: 'DELETE',
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((payload as { error?: string }).error || 'Failed to reset saved search values');
      }

      const refresh = await fetch(`/api/listings/search-prefill/${listingId}`);
      const refreshPayload = await refresh.json().catch(() => ({}));
      if (!refresh.ok) {
        throw new Error((refreshPayload as { error?: string }).error || 'Failed to reload default search values');
      }

      const nextData = refreshPayload as SearchPrefillResponse;
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
      const res = await fetch(`/api/listings/search-prefill/${listingId}`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((payload as { error?: string }).error || 'Failed to load search fields');
      }
      const nextData = payload as SearchPrefillResponse;
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
      const params = new URLSearchParams();
      if (value) params.set('location', value);
      const res = await fetch(`/api/mobile-bg/location-options?${params.toString()}`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) return;

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
      const res = await fetch('/api/mobile-bg/search-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: data.form.action,
          method: data.form.method,
          fields,
          sourceListingId: listingId,
          sourceMobileId: data.listing.mobile_id,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((payload as { error?: string }).error || 'Failed to load mobile.bg results');
      }
      setResults(payload as MobileBgSearchResultsResponse);
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
                    <div className="grid gap-2 md:grid-cols-2">
                      {(() => {
                        const selectedMake = getFieldValue('marka');
                        const modelOptions = data.options.modelsByMake[selectedMake] ?? [];
                        const makeOptions = data.options.makes;
                        return editableFields
                          .filter((field) => !HIDDEN_FIELD_NAMES.has(field.name))
                          .map((field) => {
                            const selectedReferenceCount =
                              field.name === 'marka'
                                ? getSelectedOptionCount(makeOptions, field.value)
                                : field.name === 'model'
                                  ? getSelectedOptionCount(modelOptions, field.value)
                                  : null;
                            return (
                          <div key={field.name} className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)] items-center gap-3 rounded border border-slate-500/60 bg-slate-700/90 px-3 py-2">
                            <div className="min-w-0">
                              <div className="text-sm text-slate-50">{field.name === 'f18' ? subLocationLabel : field.label}</div>
                              <div className="text-xs uppercase tracking-wide text-slate-200/60">{field.name}</div>
                            </div>
                            <div className="min-w-0">
                              {field.name === 'marka' ? (
                                <>
                                  <div className="relative">
                                    <select
                                      value={field.value}
                                      onChange={(event) => updateMake(event.target.value)}
                                      className="w-full rounded border border-slate-400/70 bg-slate-100 px-3 py-2 pr-14 text-sm text-slate-950 focus:border-blue-500 focus:outline-none"
                                    >
                                      <option value="">Select make</option>
                                      {data.options.makes.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.value}{option.count != null ? ` (${option.count.toLocaleString('en-US')})` : ''}
                                        </option>
                                      ))}
                                    </select>
                                    {selectedReferenceCount != null && (
                                      <div className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                                        {selectedReferenceCount.toLocaleString('en-US')}
                                      </div>
                                    )}
                                  </div>
                                </>
                              ) : field.name === 'f12' ? (
                                <select
                                  value={field.value}
                                  onChange={(event) => updateField(field.name, event.target.value)}
                                  className="w-full rounded border border-slate-400/70 bg-slate-100 px-3 py-2 text-sm text-slate-950 focus:border-blue-500 focus:outline-none"
                                >
                                  {ENGINE_OPTIONS.map((option) => (
                                    <option key={option || 'all-engines'} value={option}>
                                      {option || 'Всички типове'}
                                    </option>
                                  ))}
                                </select>
                              ) : field.name === 'f13' ? (
                                <select
                                  value={field.value}
                                  onChange={(event) => updateField(field.name, event.target.value)}
                                  className="w-full rounded border border-slate-400/70 bg-slate-100 px-3 py-2 text-sm text-slate-950 focus:border-blue-500 focus:outline-none"
                                >
                                  {TRANSMISSION_OPTIONS.map((option) => (
                                    <option key={option || 'all-transmissions'} value={option}>
                                      {option || 'Без значение'}
                                    </option>
                                  ))}
                                </select>
                              ) : field.name === 'f14' ? (
                                <select
                                  value={field.value}
                                  onChange={(event) => updateField(field.name, event.target.value)}
                                  className="w-full rounded border border-slate-400/70 bg-slate-100 px-3 py-2 text-sm text-slate-950 focus:border-blue-500 focus:outline-none"
                                >
                                  {CATEGORY_OPTIONS.map((option) => (
                                    <option key={option || 'all-categories'} value={option}>
                                    {option || 'всички категории'}
                                  </option>
                                ))}
                              </select>
                              ) : field.name === 'f17' ? (
                                <select
                                  value={field.value}
                                  onChange={(event) => void updateLocation(event.target.value)}
                                  className="w-full rounded border border-slate-400/70 bg-slate-100 px-3 py-2 text-sm text-slate-950 focus:border-blue-500 focus:outline-none"
                                >
                                  {data.options.locations.map((option) => (
                                    <option key={`${option.value || 'all-locations'}-${option.label}`} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              ) : field.name === 'f18' ? (
                                <div className="relative">
                                  <select
                                    value={field.value}
                                    onChange={(event) => updateField(field.name, event.target.value)}
                                    disabled={locationLoading}
                                    className="w-full rounded border border-slate-400/70 bg-slate-100 px-3 py-2 pr-10 text-sm text-slate-950 focus:border-blue-500 focus:outline-none disabled:cursor-wait disabled:bg-slate-200"
                                  >
                                    <option value="">всички</option>
                                    {subLocationOptions
                                      .filter((option) => option.value !== '')
                                      .map((option) => (
                                      <option key={`${option.value || 'all-sub-locations'}-${option.label}`} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                  {locationLoading && (
                                    <span className="pointer-events-none absolute right-3 top-1/2 inline-block h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-slate-500 border-t-sky-500" />
                                  )}
                                </div>
                              ) : field.name === 'model' ? (
                                <>
                                  <div className="relative">
                                    <select
                                      value={field.value}
                                      onChange={(event) => updateField(field.name, event.target.value)}
                                      className="w-full rounded border border-slate-400/70 bg-slate-100 px-3 py-2 pr-14 text-sm text-slate-950 focus:border-blue-500 focus:outline-none"
                                    >
                                      <option value="">Select model</option>
                                      {modelOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.value}{option.count != null ? ` (${option.count.toLocaleString('en-US')})` : ''}
                                        </option>
                                      ))}
                                    </select>
                                    {selectedReferenceCount != null && (
                                      <div className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                                        {selectedReferenceCount.toLocaleString('en-US')}
                                      </div>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-stretch gap-2">
                                  <input
                                    value={field.value}
                                    onChange={(event) => updateField(field.name, event.target.value)}
                                    className="w-full rounded border border-slate-400/70 bg-slate-100 px-3 py-2 text-sm text-slate-950 focus:border-blue-500 focus:outline-none"
                                  />
                                  {STEPPER_FIELDS.has(field.name) && (
                                    <div className="flex shrink-0 flex-col overflow-hidden rounded border border-slate-400/70">
                                      <button
                                        type="button"
                                        onClick={() => nudgeField(field.name, 1)}
                                        className="h-5 w-7 bg-slate-200 text-xs font-semibold text-slate-950 hover:bg-slate-300"
                                        aria-label={`Increase ${field.label}`}
                                      >
                                        +
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => nudgeField(field.name, -1)}
                                        className="h-5 w-7 border-t border-slate-400/70 bg-slate-200 text-xs font-semibold text-slate-950 hover:bg-slate-300"
                                        aria-label={`Decrease ${field.label}`}
                                      >
                                        -
                                      </button>
                                    </div>
                                  )}
                                  {CLEARABLE_FIELDS.has(field.name) && (
                                    <button
                                      type="button"
                                      onClick={() => clearField(field.name)}
                                      className="shrink-0 rounded border border-slate-400/70 bg-slate-200 px-2 text-sm font-semibold text-slate-950 hover:bg-slate-300"
                                      aria-label={`Clear ${field.label}`}
                                    >
                                      x
                                    </button>
                                  )}
                                </div>
                              )}
                              <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-200/60">{field.source}</div>
                            </div>
                          </div>
                            );
                          });
                      })()}
                    </div>
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
