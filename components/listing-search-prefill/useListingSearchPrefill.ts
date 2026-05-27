'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { toast } from 'sonner';
import {
  loadLocationOptions,
  loadMobileBgSearchResults,
  loadSearchPrefill,
  resetSearchProfileFields,
  saveSearchProfileFields,
} from '@/components/listing-search-prefill/api';
import {
  mergeEditableFields,
  takeFirstVisibleFields,
} from '@/components/listing-search-prefill/field-utils';
import { submitMobileBgSearchForm } from '@/components/listing-search-prefill/form-submit';
import type {
  MobileBgSearchResultsResponse,
  PendingAction,
  SearchField,
  SearchPrefillResponse,
} from '@/components/listing-search-prefill/types';

const DEFAULT_SUB_LOCATION_OPTIONS = [{ value: '', label: 'всички' }];
const DEFAULT_SUB_LOCATION_LABEL = 'Населено място';

export function useListingSearchPrefill(listingId: number) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<SearchPrefillResponse | null>(null);
  const [editableFields, setEditableFields] = useState<SearchField[]>([]);
  const [subLocationLabel, setSubLocationLabel] = useState(DEFAULT_SUB_LOCATION_LABEL);
  const [subLocationOptions, setSubLocationOptions] = useState<Array<{ value: string; label: string }>>(DEFAULT_SUB_LOCATION_OPTIONS);
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

  function buildSubmissionFields() {
    if (!data) return [];
    return mergeEditableFields(data.form.fields, editableFields);
  }

  function buildFirstSevenFields() {
    return takeFirstVisibleFields(buildSubmissionFields(), 7);
  }

  async function saveSearchProfile() {
    setProfileSaving(true);
    try {
      await saveSearchProfileFields(listingId, buildSubmissionFields());
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
      return;
    }
    setLoading(true);
    setError('');
    if (action) setPendingAction(action);
    if (action === 'open') setFiltersVisible(true);

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
    setSubLocationLabel(DEFAULT_SUB_LOCATION_LABEL);
    setSubLocationOptions(DEFAULT_SUB_LOCATION_OPTIONS);
    setEditableFields((prev) => prev.map((field) => {
      if (field.name === 'f17') return { ...field, value };
      if (field.name === 'f18') return { ...field, value: '', label: DEFAULT_SUB_LOCATION_LABEL, source: 'default' };
      return field;
    }));

    try {
      const payload = await loadLocationOptions(value);
      const nextLabel = typeof payload.label === 'string' && payload.label ? payload.label : DEFAULT_SUB_LOCATION_LABEL;
      const nextOptions = Array.isArray(payload.options) && payload.options.length > 0
        ? payload.options as Array<{ value: string; label: string }>
        : DEFAULT_SUB_LOCATION_OPTIONS;

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

  function submitToMobileBg(fields = buildSubmissionFields()) {
    submitMobileBgSearchForm(data?.form, fields);
  }

  function showFilters() {
    setFiltersVisible(true);
    setResults(null);
    setResultsError('');
    setResultsLoading(false);
  }

  return {
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
  };
}
