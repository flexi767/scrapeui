'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, Plus, Save, SearchIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { MobileBgSearchResultsTable } from '@/components/MobileBgSearchResultsTable';
import {
  SEARCH_ACTION,
  buildFirstSevenSearchFields,
  type SearchField,
  type SearchPrefillData,
} from '@/lib/mobile-bg/search-prefill';
import type { SavedSearchSummary } from '@/lib/mobile-bg/saved-searches';
import type { MobileBgSearchResultsPayload } from '@/lib/mobile-bg/search-results';

interface SavedSearchDetailResponse {
  detail: {
    search: {
      id: number;
      listingId: number;
      createdAt: string | null;
      updatedAt: string | null;
    };
    prefill: SearchPrefillData;
  };
}

interface SavedSearchListResponse {
  searches: SavedSearchSummary[];
}

interface SavedSearchMutationResponse extends SavedSearchListResponse, SavedSearchDetailResponse {}

interface MobileBgSearchResultsResponse extends MobileBgSearchResultsPayload {
  fallback_note?: string | null;
}

const HIDDEN_FIELD_NAMES = new Set(['topmenu', 'rub', 'act', 'rub_pub_save', 'pubtype', 'f20', 'f9']);
const ENGINE_OPTIONS = ['', 'Бензинов', 'Дизелов', 'Електрически', 'Хибриден', 'Plug-in хибрид', 'Газ', 'Водород'];
const TRANSMISSION_OPTIONS = ['', 'Ръчна', 'Автоматична', 'Полуавтоматична'];
const CATEGORY_OPTIONS = ['', 'Ван', 'Джип', 'Кабрио', 'Комби', 'Купе', 'Миниван', 'Пикап', 'Седан', 'Стреч лимузина', 'Хечбек'];
const STEPPER_FIELDS = new Set(['f10', 'f11', 'f25', 'f26']);
const CLEARABLE_FIELDS = new Set(['f25', 'f26', 'f7', 'f8', 'f15']);

function formatYearRange(search: SavedSearchSummary) {
  if (search.yearFrom && search.yearTo) return `${search.yearFrom} - ${search.yearTo}`;
  if (search.yearFrom) return `from ${search.yearFrom}`;
  if (search.yearTo) return `to ${search.yearTo}`;
  if (search.regYear) return search.regYear;
  return '—';
}

function formatSavedAt(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SavedSearchesWorkspace({
  initialSearches,
  initialDetail,
}: {
  initialSearches: SavedSearchSummary[];
  initialDetail: SavedSearchDetailResponse['detail'] | null;
}) {
  const [searches, setSearches] = useState(initialSearches);
  const [selectedId, setSelectedId] = useState<number | null>(initialDetail?.search.id ?? initialSearches[0]?.id ?? null);
  const [detail, setDetail] = useState<SavedSearchDetailResponse['detail'] | null>(initialDetail);
  const [editableFields, setEditableFields] = useState<SearchField[]>(initialDetail?.prefill.form.fields.map((field) => ({ ...field })) ?? []);
  const [subLocationLabel, setSubLocationLabel] = useState(initialDetail?.prefill.options.subLocations.label ?? 'Населено място');
  const [subLocationOptions, setSubLocationOptions] = useState(initialDetail?.prefill.options.subLocations.options ?? [{ value: '', label: 'всички' }]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState('');
  const [results, setResults] = useState<MobileBgSearchResultsResponse | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [cloneBusy, setCloneBusy] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const listing = detail?.prefill.listing ?? null;

  useEffect(() => {
    if (selectedId == null) {
      setDetail(null);
      setEditableFields([]);
      setResults(null);
      return;
    }

    if (detail?.search.id === selectedId) return;

    let cancelled = false;
    setLoadingDetail(true);
    setResults(null);
    setResultsError('');

    void fetch(`/api/saved-searches/${selectedId}`)
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((payload as { error?: string }).error || 'Failed to load saved search');
        }
        return payload as SavedSearchDetailResponse;
      })
      .then((payload) => {
        if (cancelled) return;
        setDetail(payload.detail);
        setEditableFields(payload.detail.prefill.form.fields.map((field) => ({ ...field })));
        setSubLocationLabel(payload.detail.prefill.options.subLocations.label);
        setSubLocationOptions(payload.detail.prefill.options.subLocations.options);
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(error instanceof Error ? error.message : 'Failed to load saved search');
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId, detail]);

  const selectedSummary = useMemo(
    () => searches.find((entry) => entry.id === selectedId) ?? null,
    [searches, selectedId],
  );

  function syncFromDetail(nextDetail: SavedSearchDetailResponse['detail']) {
    setDetail(nextDetail);
    setEditableFields(nextDetail.prefill.form.fields.map((field) => ({ ...field })));
    setSubLocationLabel(nextDetail.prefill.options.subLocations.label);
    setSubLocationOptions(nextDetail.prefill.options.subLocations.options);
  }

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
      const validModels = detail?.prefill.options.modelsByMake[value] ?? [];
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
    if (!detail) return [];
    return detail.prefill.form.fields.map((field) => {
      const edited = editableFields.find((candidate) => candidate.name === field.name);
      return edited ?? field;
    });
  }

  function openInMobileBg(fields = buildSubmissionFields()) {
    if (typeof document === 'undefined') return;
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = SEARCH_ACTION;
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

  async function showResultsHere(fields = buildSubmissionFields()) {
    if (!detail || !listing) return;
    setResultsLoading(true);
    setResultsError('');

    try {
      const res = await fetch('/api/mobile-bg/search-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: detail.prefill.form.action,
          method: detail.prefill.form.method,
          fields,
          sourceListingId: listing.id,
          sourceMobileId: listing.mobile_id,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((payload as { error?: string }).error || 'Failed to load mobile.bg results');
      }
      setResults(payload as MobileBgSearchResultsResponse);
    } catch (error) {
      setResultsError(error instanceof Error ? error.message : 'Failed to load mobile.bg results');
      setResults(null);
    } finally {
      setResultsLoading(false);
    }
  }

  async function saveCurrent() {
    if (!detail) return;
    setSaveBusy(true);
    try {
      const res = await fetch(`/api/saved-searches/${detail.search.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: buildSubmissionFields() }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((payload as { error?: string }).error || 'Failed to save search');
      }

      const data = payload as SavedSearchMutationResponse;
      setSearches(data.searches);
      syncFromDetail(data.detail);
      toast.success('Saved search updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save search');
    } finally {
      setSaveBusy(false);
    }
  }

  async function saveAsNew() {
    if (!detail) return;
    setCloneBusy(true);
    try {
      const res = await fetch('/api/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: detail.search.listingId,
          fields: buildSubmissionFields(),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((payload as { error?: string }).error || 'Failed to create saved search');
      }

      const data = payload as SavedSearchMutationResponse;
      setSearches(data.searches);
      syncFromDetail(data.detail);
      setSelectedId(data.detail.search.id);
      toast.success('Created a new saved search');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create saved search');
    } finally {
      setCloneBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900/70">
        <div className="border-b border-gray-700 px-4 py-3">
          <div className="text-sm font-medium text-gray-200">Saved searches</div>
          <div className="text-xs text-gray-500">{searches.length} total</div>
        </div>
        <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
          {searches.length === 0 ? (
            <div className="px-4 py-8 text-sm text-gray-500">No saved searches yet.</div>
          ) : (
            <div className="divide-y divide-gray-800">
              {searches.map((search) => {
                const active = search.id === selectedId;
                return (
                  <button
                    key={search.id}
                    type="button"
                    onClick={() => setSelectedId(search.id)}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      active ? 'bg-gray-800/80' : 'hover:bg-gray-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-white">
                          {[search.make, search.model].filter(Boolean).join(' ') || 'Saved search'}
                        </div>
                        <div className="truncate text-xs text-gray-400">
                          Year range: {formatYearRange(search)}
                        </div>
                        <div className="mt-1 truncate text-[11px] text-gray-500">
                          Entry: {search.title || '—'}{search.mobileId ? ` • ${search.mobileId}` : ''}
                        </div>
                      </div>
                      <div className="shrink-0 text-[11px] text-gray-500">#{search.id}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        {loadingDetail ? (
          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-12 text-center text-sm text-gray-400">
            <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
            Loading saved search…
          </div>
        ) : !detail || !listing || !selectedSummary ? (
          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-12 text-center text-sm text-gray-500">
            Select a saved search to edit it.
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold text-white">
                    {[listing.make, listing.model].filter(Boolean).join(' ') || 'Saved search'}
                  </div>
                  <div className="mt-1 text-sm text-gray-400">
                    Entry listing: {listing.title || '—'}{listing.mobile_id ? ` • ${listing.mobile_id}` : ''}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Updated {formatSavedAt(detail.search.updatedAt)} • Created {formatSavedAt(detail.search.createdAt)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-600 bg-gray-900/80 text-gray-200 hover:bg-gray-800 hover:text-white"
                    onClick={() => void showResultsHere(buildFirstSevenSearchFields(buildSubmissionFields()))}
                    disabled={resultsLoading}
                  >
                    <SearchIcon className="mr-2 h-4 w-4" />
                    Quick Results
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-sky-700 bg-sky-950/80 text-sky-200 hover:bg-sky-900 hover:text-white"
                    onClick={() => void showResultsHere()}
                    disabled={resultsLoading}
                  >
                    {resultsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SearchIcon className="mr-2 h-4 w-4" />}
                    Search Here
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-600 bg-gray-900/80 text-gray-200 hover:bg-gray-800 hover:text-white"
                    onClick={() => openInMobileBg()}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open mobile.bg
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-emerald-700 bg-emerald-950/80 text-emerald-200 hover:bg-emerald-900 hover:text-white"
                    onClick={() => void saveCurrent()}
                    disabled={saveBusy}
                  >
                    {saveBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-amber-700 bg-amber-950/80 text-amber-200 hover:bg-amber-900 hover:text-white"
                    onClick={() => void saveAsNew()}
                    disabled={cloneBusy}
                  >
                    {cloneBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Save As New
                  </Button>
                </div>
              </div>

              <div className="mt-3 text-xs text-gray-500">
                Reference counts: {detail.prefill.reference.makeCount != null ? detail.prefill.reference.makeCount.toLocaleString('en-US') : '—'} for make
                {detail.prefill.reference.modelCount != null ? ` • ${detail.prefill.reference.modelCount.toLocaleString('en-US')} for model` : ''}
              </div>
              {detail.prefill.omitted.length > 0 && (
                <div className="mt-2 text-xs text-amber-300/80">
                  {detail.prefill.omitted.join(' ')}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-gray-700 bg-gray-900/70">
              <div className="border-b border-gray-700 px-4 py-3 text-sm font-medium text-gray-200">Search fields</div>
              <div className="grid gap-2 p-4 md:grid-cols-2">
                {editableFields.filter((field) => !HIDDEN_FIELD_NAMES.has(field.name)).map((field) => {
                  const selectedMake = getFieldValue('marka');
                  const modelOptions = detail.prefill.options.modelsByMake[selectedMake] ?? [];

                  return (
                    <div key={field.name} className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)] items-center gap-3 rounded border border-gray-700 bg-gray-800/70 px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm text-gray-100">{field.name === 'f18' ? subLocationLabel : field.label}</div>
                        <div className="text-xs uppercase tracking-wide text-gray-500">{field.name}</div>
                      </div>
                      <div className="min-w-0">
                        {field.name === 'marka' ? (
                          <select
                            value={field.value}
                            onChange={(event) => updateMake(event.target.value)}
                            className="w-full rounded border border-gray-500 bg-gray-100 px-3 py-2 text-sm text-gray-950 focus:border-blue-500 focus:outline-none"
                          >
                            <option value="">Select make</option>
                            {detail.prefill.options.makes.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.value}{option.count != null ? ` (${option.count.toLocaleString('en-US')})` : ''}
                              </option>
                            ))}
                          </select>
                        ) : field.name === 'model' ? (
                          <select
                            value={field.value}
                            onChange={(event) => updateField(field.name, event.target.value)}
                            className="w-full rounded border border-gray-500 bg-gray-100 px-3 py-2 text-sm text-gray-950 focus:border-blue-500 focus:outline-none"
                          >
                            <option value="">All models</option>
                            {modelOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.value}{option.count != null ? ` (${option.count.toLocaleString('en-US')})` : ''}
                              </option>
                            ))}
                          </select>
                        ) : field.name === 'f12' ? (
                          <select
                            value={field.value}
                            onChange={(event) => updateField(field.name, event.target.value)}
                            className="w-full rounded border border-gray-500 bg-gray-100 px-3 py-2 text-sm text-gray-950 focus:border-blue-500 focus:outline-none"
                          >
                            {ENGINE_OPTIONS.map((option) => <option key={option || 'engine-all'} value={option}>{option || 'Всички типове'}</option>)}
                          </select>
                        ) : field.name === 'f13' ? (
                          <select
                            value={field.value}
                            onChange={(event) => updateField(field.name, event.target.value)}
                            className="w-full rounded border border-gray-500 bg-gray-100 px-3 py-2 text-sm text-gray-950 focus:border-blue-500 focus:outline-none"
                          >
                            {TRANSMISSION_OPTIONS.map((option) => <option key={option || 'trans-all'} value={option}>{option || 'Без значение'}</option>)}
                          </select>
                        ) : field.name === 'f14' ? (
                          <select
                            value={field.value}
                            onChange={(event) => updateField(field.name, event.target.value)}
                            className="w-full rounded border border-gray-500 bg-gray-100 px-3 py-2 text-sm text-gray-950 focus:border-blue-500 focus:outline-none"
                          >
                            {CATEGORY_OPTIONS.map((option) => <option key={option || 'cat-all'} value={option}>{option || 'всички категории'}</option>)}
                          </select>
                        ) : field.name === 'f17' ? (
                          <select
                            value={field.value}
                            onChange={(event) => void updateLocation(event.target.value)}
                            className="w-full rounded border border-gray-500 bg-gray-100 px-3 py-2 text-sm text-gray-950 focus:border-blue-500 focus:outline-none"
                          >
                            {detail.prefill.options.locations.map((option) => (
                              <option key={`${option.value || 'loc-all'}-${option.label}`} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        ) : field.name === 'f18' ? (
                          <div className="relative">
                            <select
                              value={field.value}
                              onChange={(event) => updateField(field.name, event.target.value)}
                              disabled={locationLoading}
                              className="w-full rounded border border-gray-500 bg-gray-100 px-3 py-2 pr-10 text-sm text-gray-950 focus:border-blue-500 focus:outline-none disabled:cursor-wait"
                            >
                              <option value="">всички</option>
                              {subLocationOptions.filter((option) => option.value !== '').map((option) => (
                                <option key={`${option.value}-${option.label}`} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                            {locationLoading && <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-500" />}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              value={field.value}
                              onChange={(event) => updateField(field.name, event.target.value)}
                              className="min-w-0 flex-1 rounded border border-gray-500 bg-gray-100 px-3 py-2 text-sm text-gray-950 focus:border-blue-500 focus:outline-none"
                            />
                            {STEPPER_FIELDS.has(field.name) && (
                              <>
                                <button type="button" className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700" onClick={() => nudgeField(field.name, -1)}>-1</button>
                                <button type="button" className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700" onClick={() => nudgeField(field.name, 1)}>+1</button>
                              </>
                            )}
                            {CLEARABLE_FIELDS.has(field.name) && field.value && (
                              <button type="button" className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700" onClick={() => clearField(field.name)}>Clear</button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {resultsError && (
              <div className="rounded-lg border border-red-700/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {resultsError}
              </div>
            )}

            {resultsLoading && (
              <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-10 text-center text-sm text-gray-400">
                <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
                Loading mobile.bg results…
              </div>
            )}

            {results && !resultsLoading && (
              <MobileBgSearchResultsTable
                rows={results.rows}
                summaryText={results.summary_text}
                page={results.page}
                totalPages={results.total_pages}
                hasNextPage={results.has_next_page}
                loadedUntilPage={results.loaded_until_page}
                sourceListingId={listing.id}
                sourceMobileId={listing.mobile_id}
                initialIgnoredResultIds={results.ignored_search_result_ids}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}
