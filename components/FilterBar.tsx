'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface Props {
  makes: string[];
  makeModels: Record<string, string[]>;
  allDealers: { slug: string; name: string; type: string }[];
}

export default function FilterBar({ makes, makeModels, allDealers }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentMake = searchParams.get('make') ?? '';
  const currentModel = searchParams.get('model') ?? '';
  const currentDealers = searchParams.getAll('dealer');
  const currentSearch = searchParams.get('search') ?? '';

  const [searchInput, setSearchInput] = useState(currentSearch);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync search input when URL changes externally
  useEffect(() => {
    setSearchInput(searchParams.get('search') ?? '');
  }, [searchParams]);

  function buildParams(overrides: Record<string, string | string[]> = {}) {
    const p = new URLSearchParams();
    // Preserve existing non-filter params
    const keep = ['sort', 'order'];
    for (const k of keep) {
      const v = searchParams.get(k);
      if (v) p.set(k, v);
    }
    // Apply current values
    if (currentMake) p.set('make', currentMake);
    if (currentModel) p.set('model', currentModel);
    for (const d of currentDealers) p.append('dealer', d);
    if (currentSearch) p.set('search', currentSearch);
    // Apply overrides
    for (const [key, val] of Object.entries(overrides)) {
      p.delete(key);
      if (Array.isArray(val)) {
        for (const v of val) p.append(key, v);
      } else if (val) {
        p.set(key, val);
      }
    }
    p.delete('page');
    return p.toString();
  }

  function onMakeChange(make: string) {
    router.push(`/?${buildParams({ make, model: '' })}`);
  }

  function onModelChange(model: string) {
    router.push(`/?${buildParams({ model })}`);
  }

  function onDealerToggle(slug: string) {
    const next = currentDealers.includes(slug)
      ? currentDealers.filter((d) => d !== slug)
      : [...currentDealers, slug];
    router.push(`/?${buildParams({ dealer: next })}`);
  }

  function onSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.push(`/?${buildParams({ search: value })}`);
    }, 350);
  }

  function onClearAll() {
    const p = new URLSearchParams();
    const sort = searchParams.get('sort');
    const order = searchParams.get('order');
    if (sort) p.set('sort', sort);
    if (order) p.set('order', order);
    router.push(`/?${p.toString()}`);
  }

  const availableModels = currentMake ? (makeModels[currentMake] ?? []) : [];
  const hasFilters =
    currentMake || currentModel || currentDealers.length > 0 || currentSearch;

  return (
    <div className="flex flex-wrap items-start gap-3">
      {/* Search */}
      <input
        type="search"
        placeholder="Search listings…"
        value={searchInput}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-8 w-48 rounded border border-gray-600 bg-gray-800 px-3 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
      />

      {/* Make */}
      <select
        value={currentMake}
        onChange={(e) => onMakeChange(e.target.value)}
        className="h-8 rounded border border-gray-600 bg-gray-800 px-2 text-sm text-white focus:border-blue-500 focus:outline-none"
      >
        <option value="">All Makes</option>
        {makes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      {/* Model */}
      <select
        value={currentModel}
        onChange={(e) => onModelChange(e.target.value)}
        disabled={!currentMake}
        className="h-8 rounded border border-gray-600 bg-gray-800 px-2 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-40"
      >
        <option value="">All Models</option>
        {availableModels.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      {/* Dealer checkboxes */}
      <div className="flex flex-wrap items-center gap-2">
        {allDealers.map((d) => (
          <label
            key={d.slug}
            className="flex cursor-pointer items-center gap-1.5 rounded border border-gray-600 px-2 py-1 text-xs transition-colors hover:border-gray-400"
            style={
              currentDealers.includes(d.slug)
                ? { borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)' }
                : {}
            }
          >
            <input
              type="checkbox"
              checked={currentDealers.includes(d.slug)}
              onChange={() => onDealerToggle(d.slug)}
              className="accent-blue-500"
            />
            <span className="text-gray-200">{d.name}</span>
            {d.type === 'own' && (
              <span className="rounded-full bg-emerald-700 px-1 text-[10px] text-emerald-100">
                own
              </span>
            )}
          </label>
        ))}
      </div>

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={onClearAll}
          className="h-8 rounded border border-gray-600 px-3 text-xs text-gray-400 hover:border-gray-400 hover:text-white"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
