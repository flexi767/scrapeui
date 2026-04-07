'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

interface Props {
  makes: string[];
  makeModels: Record<string, string[]>;
  allDealers: { slug: string; name: string; own: number }[];
  fieldOptions: { value: string; label: string }[];
  whenOptions: { value: string; label: string }[];
  total: number;
  basePath?: string;
}

export default function ChangesFilterBar({
  makes,
  makeModels,
  allDealers,
  fieldOptions,
  whenOptions,
  total,
  basePath = '/listings/changes',
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentMake = searchParams.get('make') ?? '';
  const currentModel = searchParams.get('model') ?? '';
  const currentDealer = searchParams.get('dealer') ?? '';
  const currentField = searchParams.get('field') ?? '';
  const currentWhen = searchParams.get('when') ?? '';
  const currentSearch = searchParams.get('search') ?? '';

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function buildParams(overrides: Record<string, string> = {}) {
    const p = new URLSearchParams();
    if (currentMake) p.set('make', currentMake);
    if (currentModel) p.set('model', currentModel);
    if (currentDealer) p.set('dealer', currentDealer);
    if (currentField) p.set('field', currentField);
    if (currentWhen) p.set('when', currentWhen);
    if (currentSearch) p.set('search', currentSearch);

    for (const [key, value] of Object.entries(overrides)) {
      if (!value) p.delete(key);
      else p.set(key, value);
    }

    p.delete('page');
    return p.toString();
  }

  const availableModels = currentMake ? (makeModels[currentMake] ?? []) : [];
  const hasFilters = currentMake || currentModel || currentDealer || currentField || currentWhen || currentSearch;

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

      <select
        value={currentDealer}
        onChange={(e) => router.push(`${basePath}?${buildParams({ dealer: e.target.value })}`)}
        className="h-8 rounded border border-gray-600 bg-gray-800 px-2 text-sm text-white focus:border-blue-500 focus:outline-none"
      >
        <option value="">Dealer</option>
        {allDealers.map((dealer) => (
          <option key={dealer.slug} value={dealer.slug}>{dealer.name}</option>
        ))}
      </select>

      <select
        value={currentField}
        onChange={(e) => router.push(`${basePath}?${buildParams({ field: e.target.value })}`)}
        className="h-8 rounded border border-gray-600 bg-gray-800 px-2 text-sm text-white focus:border-blue-500 focus:outline-none"
      >
        <option value="">Field</option>
        {fieldOptions.map((field) => (
          <option key={field.value} value={field.value}>{field.label}</option>
        ))}
      </select>

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
