'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

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
  const [dealerOpen, setDealerOpen] = useState(false);
  const [fieldOpen, setFieldOpen] = useState(false);
  const dealerRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dealerRef.current && !dealerRef.current.contains(e.target as Node)) setDealerOpen(false);
      if (fieldRef.current && !fieldRef.current.contains(e.target as Node)) setFieldOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
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

      <div className="relative" ref={dealerRef}>
        <button
          onClick={() => setDealerOpen((open) => !open)}
          className={`flex h-8 items-center gap-1.5 rounded border px-3 text-sm text-white transition-colors ${
            currentDealers.length > 0
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-gray-600 bg-gray-800 hover:border-gray-400'
          }`}
        >
          {currentDealers.length === 0
            ? 'Dealers'
            : currentDealers.length === 1
            ? allDealers.find((dealer) => dealer.slug === currentDealers[0])?.name ?? currentDealers[0]
            : `${currentDealers.length} dealers`}
          <span className="text-gray-400">{dealerOpen ? '▲' : '▼'}</span>
        </button>
        {dealerOpen && (
          <div className="absolute left-0 top-9 z-30 min-w-[180px] rounded border border-gray-600 bg-gray-800 py-1 shadow-lg">
            {allDealers.map((dealer) => (
              <label key={dealer.slug} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700">
                <input
                  type="checkbox"
                  checked={currentDealers.includes(dealer.slug)}
                  onChange={() => onDealerToggle(dealer.slug)}
                  className="accent-blue-500"
                />
                <span>{dealer.name}</span>
                {Boolean(dealer.own) && <span className="ml-auto rounded-full bg-emerald-700 px-1.5 text-[10px] text-emerald-100">own</span>}
              </label>
            ))}
            {currentDealers.length > 0 && (
              <button
                onClick={() => {
                  router.push(`${basePath}?${buildParams({ dealer: [] })}`);
                  setDealerOpen(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-gray-400 hover:text-white"
              >
                Clear dealers
              </button>
            )}
          </div>
        )}
      </div>

      <div className="relative" ref={fieldRef}>
        <button
          onClick={() => setFieldOpen((open) => !open)}
          className={`flex h-8 items-center gap-1.5 rounded border px-3 text-sm text-white transition-colors ${
            currentFieldsFromUrl.length > 0
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-gray-600 bg-gray-800 hover:border-gray-400'
          }`}
        >
          {currentFieldsFromUrl.length === 0
            ? 'Fields'
            : currentFields.length === fieldOptions.length
            ? 'Fields'
            : currentFields.length === 1
            ? fieldOptions.find((field) => field.value === currentFields[0])?.label ?? currentFields[0]
            : `Fields (${currentFields.length})`}
          <span className="text-gray-400">{fieldOpen ? '▲' : '▼'}</span>
        </button>
        {fieldOpen && (
          <div className="absolute left-0 top-9 z-30 min-w-[180px] rounded border border-gray-600 bg-gray-800 py-1 shadow-lg">
            {fieldOptions.map((field) => (
              <label key={field.value} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700">
                <input
                  type="checkbox"
                  checked={currentFields.includes(field.value)}
                  onChange={() => onFieldToggle(field.value)}
                  className="accent-blue-500"
                />
                <span>{field.label}</span>
              </label>
            ))}
            {(currentFieldsFromUrl.length > 0 || currentFields.length !== defaultFieldValues.length) && (
              <button
                onClick={() => {
                  router.push(`${basePath}?${buildParams({ field: [] })}`);
                  setFieldOpen(false);
                }}
                className="w-full px-3 py-1.5 text-left text-xs text-gray-400 hover:text-white"
              >
                Reset fields
              </button>
            )}
          </div>
        )}
      </div>

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
        {total.toLocaleString('en-US')} changes
      </span>
    </div>
  );
}
