'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import MultiSelectDropdown from './filter-bar/MultiSelectDropdown';
import { formatCount } from '@/lib/utils';

interface Props {
  makes: string[];
  makeModels: Record<string, string[]>;
  allDealers: { slug: string; name: string; own: number }[];
  fieldOptions: { value: string; label: string }[];
  defaultFieldValues: string[];
  whenOptions: { value: string; label: string }[];
  total: number;
  basePath?: string;
}

export default function ChangesFilterBar({
  makes,
  makeModels,
  allDealers,
  fieldOptions,
  defaultFieldValues,
  whenOptions,
  total,
  basePath = '/listings/changes',
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentMake = searchParams.get('make') ?? '';
  const currentModel = searchParams.get('model') ?? '';
  const currentDealers = searchParams.getAll('dealer');
  const currentFieldsFromUrl = searchParams.getAll('field');
  const currentFields = currentFieldsFromUrl.length > 0 ? currentFieldsFromUrl : defaultFieldValues;
  const currentWhen = searchParams.get('when') ?? '';
  const currentSearch = searchParams.get('search') ?? '';

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function buildParams(overrides: Record<string, string | string[]> = {}) {
    const p = new URLSearchParams();
    if (currentMake) p.set('make', currentMake);
    if (currentModel) p.set('model', currentModel);
    currentDealers.forEach((dealer) => p.append('dealer', dealer));
    currentFieldsFromUrl.forEach((field) => p.append('field', field));
    if (currentWhen) p.set('when', currentWhen);
    if (currentSearch) p.set('search', currentSearch);

    for (const [key, value] of Object.entries(overrides)) {
      p.delete(key);
      if (Array.isArray(value)) {
        value.filter(Boolean).forEach((entry) => p.append(key, entry));
      } else if (value) {
        p.set(key, value);
      }
    }

    p.delete('page');
    return p.toString();
  }

  function onDealerToggle(slug: string) {
    const next = currentDealers.includes(slug)
      ? currentDealers.filter((dealer) => dealer !== slug)
      : [...currentDealers, slug];
    router.push(`${basePath}?${buildParams({ dealer: next })}`);
  }

  function onFieldToggle(value: string) {
    const next = currentFields.includes(value)
      ? currentFields.filter((field) => field !== value)
      : [...currentFields, value];
    router.push(`${basePath}?${buildParams({ field: next })}`);
  }

  const availableModels = currentMake ? (makeModels[currentMake] ?? []) : [];
  const hasFilters =
    currentMake ||
    currentModel ||
    currentDealers.length > 0 ||
    currentFieldsFromUrl.length > 0 ||
    currentWhen ||
    currentSearch;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input
        key={currentSearch}
        type="search"
        placeholder="Search…"
        defaultValue={currentSearch}
        onChange={(e) => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          const value = e.target.value;
          debounceRef.current = setTimeout(() => {
            router.push(`${basePath}?${buildParams({ search: value })}`);
          }, 350);
        }}
        className="h-8 w-28 rounded border border-gray-600 bg-gray-800 px-2 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
      />

      <select
        value={currentMake}
        onChange={(e) => router.push(`${basePath}?${buildParams({ make: e.target.value, model: '' })}`)}
        className="h-8 rounded border border-gray-600 bg-gray-800 px-2 text-sm text-white focus:border-blue-500 focus:outline-none"
      >
        <option value="">Make</option>
        {makes.map((make) => (
          <option key={make} value={make}>{make}</option>
        ))}
      </select>

      <select
        value={currentModel}
        disabled={!currentMake}
        onChange={(e) => router.push(`${basePath}?${buildParams({ model: e.target.value })}`)}
        className="h-8 rounded border border-gray-600 bg-gray-800 px-2 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-40"
      >
        <option value="">Model</option>
        {availableModels.map((model) => (
          <option key={model} value={model}>{model}</option>
        ))}
      </select>

      <MultiSelectDropdown
        buttonText={
          currentDealers.length === 0
            ? 'Dealers'
            : currentDealers.length === 1
            ? allDealers.find((dealer) => dealer.slug === currentDealers[0])?.name ?? currentDealers[0]
            : `${currentDealers.length} dealers`
        }
        clearLabel="Clear dealers"
        options={allDealers.map((dealer) => ({
          value: dealer.slug,
          label: dealer.name,
          badge: dealer.own ? 'own' : undefined,
        }))}
        selectedValues={currentDealers}
        onToggle={onDealerToggle}
        onClear={() => router.push(`${basePath}?${buildParams({ dealer: [] })}`)}
        minWidthClassName="min-w-[180px]"
      />

      <MultiSelectDropdown
        buttonText={
          currentFieldsFromUrl.length === 0
            ? 'Fields'
            : currentFields.length === fieldOptions.length
            ? 'Fields'
            : currentFields.length === 1
            ? fieldOptions.find((field) => field.value === currentFields[0])?.label ?? currentFields[0]
            : `Fields (${currentFields.length})`
        }
        clearLabel="Reset fields"
        options={fieldOptions}
        selectedValues={currentFields}
        onToggle={onFieldToggle}
        onClear={() => router.push(`${basePath}?${buildParams({ field: [] })}`)}
        active={currentFieldsFromUrl.length > 0}
        showClear={currentFieldsFromUrl.length > 0 || currentFields.length !== defaultFieldValues.length}
        minWidthClassName="min-w-[180px]"
      />

      <select
        value={currentWhen}
        onChange={(e) => router.push(`${basePath}?${buildParams({ when: e.target.value })}`)}
        className="h-8 rounded border border-gray-600 bg-gray-800 px-2 text-sm text-white focus:border-blue-500 focus:outline-none"
      >
        <option value="">When</option>
        {whenOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>

      {hasFilters && (
        <button
          onClick={() => router.push(basePath)}
          className="h-8 rounded border border-gray-600 bg-gray-800 px-3 text-sm text-gray-300 hover:border-gray-400 hover:text-white"
        >
          Clear
        </button>
      )}

      <span className="ml-auto text-sm text-gray-400">
        {formatCount(total)} changes
      </span>
    </div>
  );
}
