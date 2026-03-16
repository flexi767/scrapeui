'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import PriceChangeFilter from './PriceChangeFilter';
import RangeFilter from './RangeFilter';

interface Props {
  makes: string[];
  makeModels: Record<string, string[]>;
  allDealers: { slug: string; name: string; own: number }[];
  allYears: string[];
  allFuels: string[];
  total: number;
  priceChangeRange?: { min: number; max: number } | null;
  priceRange?: { min: number; max: number } | null;
}

export default function FilterBar({ makes, makeModels, allDealers, allYears, allFuels, total, priceChangeRange, priceRange }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentMake = searchParams.get('make') ?? '';
  const currentModel = searchParams.get('model') ?? '';
  const currentDealers = searchParams.getAll('dealer');
  const currentYears = searchParams.getAll('year');
  const currentStatuses = searchParams.getAll('status');
  const currentVat = searchParams.getAll('vat');
  const currentFuels = searchParams.getAll('fuel');
  const currentSearch = searchParams.get('search') ?? '';

  const [searchInput, setSearchInput] = useState(currentSearch);
  const [dealerOpen, setDealerOpen] = useState(false);
  const dealerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dealer dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dealerRef.current && !dealerRef.current.contains(e.target as Node)) {
        setDealerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Sync search input when URL changes externally
  useEffect(() => {
    setSearchInput(searchParams.get('search') ?? '');
  }, [searchParams]);

  function buildParams(overrides: Record<string, string | string[]> = {}) {
    const p = new URLSearchParams();
    const keep = ['sort', 'order'];
    for (const k of keep) {
      const v = searchParams.get(k);
      if (v) p.set(k, v);
    }
    if (currentMake) p.set('make', currentMake);
    if (currentModel) p.set('model', currentModel);
    for (const d of currentDealers) p.append('dealer', d);
    for (const y of currentYears) p.append('year', y);
    for (const s of currentStatuses) p.append('status', s);
    for (const v of currentVat) p.append('vat', v);
    for (const f of currentFuels) p.append('fuel', f);
    for (const f of currentFuels) p.append('fuel', f);
    if (currentSearch) p.set('search', currentSearch);
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
  const [yearOpen, setYearOpen] = useState(false);
  const yearRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (yearRef.current && !yearRef.current.contains(e.target as Node)) setYearOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function onYearToggle(year: string) {
    const next = currentYears.includes(year)
      ? currentYears.filter(y => y !== year)
      : [...currentYears, year];
    router.push(`/?${buildParams({ year: next })}`);
  }

  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function onStatusToggle(s: string) {
    const next = currentStatuses.includes(s) ? currentStatuses.filter(x => x !== s) : [...currentStatuses, s];
    router.push(`/?${buildParams({ status: next })}`);
  }

  const STATUS_OPTIONS = [
    { value: 'top', label: 'TOP' },
    { value: 'vip', label: 'VIP' },
    { value: 'none', label: 'None' },
  ];

  const [vatOpen, setVatOpen] = useState(false);
  const vatRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (vatRef.current && !vatRef.current.contains(e.target as Node)) setVatOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function onVatToggle(v: string) {
    const next = currentVat.includes(v) ? currentVat.filter(x => x !== v) : [...currentVat, v];
    router.push(`/?${buildParams({ vat: next })}`);
  }

  const VAT_OPTIONS = [
    { value: 'included', label: 'има' },
    { value: 'exempt', label: 'няма' },
    { value: 'excluded', label: '+ДДС' },
    { value: 'null', label: '—' },
  ];

  const [fuelOpen, setFuelOpen] = useState(false);
  const fuelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (fuelRef.current && !fuelRef.current.contains(e.target as Node)) setFuelOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function onFuelToggle(f: string) {
    const next = currentFuels.includes(f) ? currentFuels.filter(x => x !== f) : [...currentFuels, f];
    router.push(`/?${buildParams({ fuel: next })}`);
  }

  const hasFilters = currentMake || currentModel || currentDealers.length > 0 || currentYears.length > 0 || currentStatuses.length > 0 || currentVat.length > 0 || currentFuels.length > 0 || currentSearch || searchParams.get('p_min') || searchParams.get('p_max') || searchParams.get('pc_min') || searchParams.get('pc_max');

  const dealerLabel = currentDealers.length === 0
    ? 'All Dealers'
    : currentDealers.length === 1
      ? allDealers.find(d => d.slug === currentDealers[0])?.name ?? currentDealers[0]
      : `${currentDealers.length} dealers`;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
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
          <option key={m} value={m}>{m}</option>
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
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      {/* Status multi-select dropdown */}
      <div className="relative" ref={statusRef}>
        <button
          onClick={() => setStatusOpen(o => !o)}
          className={`flex h-8 items-center gap-1.5 rounded border px-3 text-sm text-white transition-colors ${
            currentStatuses.length > 0 ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 bg-gray-800 hover:border-gray-400'
          }`}
        >
          {currentStatuses.length === 0 ? 'All Paid' : currentStatuses.map(s => s.toUpperCase()).join(', ')}
          <span className="text-gray-400">{statusOpen ? '▲' : '▼'}</span>
        </button>
        {statusOpen && (
          <div className="absolute left-0 top-9 z-30 min-w-[120px] rounded border border-gray-600 bg-gray-800 py-1 shadow-lg">
            {STATUS_OPTIONS.map(opt => (
              <label key={opt.value} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700">
                <input type="checkbox" checked={currentStatuses.includes(opt.value)} onChange={() => onStatusToggle(opt.value)} className="accent-blue-500" />
                <span>{opt.label}</span>
              </label>
            ))}
            {currentStatuses.length > 0 && (
              <button onClick={() => { router.push(`/?${buildParams({ status: [] })}`); setStatusOpen(false); }} className="w-full px-3 py-1.5 text-left text-xs text-gray-400 hover:text-white">
                Clear paid
              </button>
            )}
          </div>
        )}
      </div>

      {/* VAT multi-select dropdown */}
      <div className="relative" ref={vatRef}>
        <button
          onClick={() => setVatOpen(o => !o)}
          className={`flex h-8 items-center gap-1.5 rounded border px-3 text-sm text-white transition-colors ${
            currentVat.length > 0 ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 bg-gray-800 hover:border-gray-400'
          }`}
        >
          {currentVat.length === 0 ? 'VAT' : currentVat.length === 1 ? 'VAT' : `VAT (${currentVat.length})`}
          <span className="text-gray-400">{vatOpen ? '▲' : '▼'}</span>
        </button>
        {vatOpen && (
          <div className="absolute left-0 top-9 z-30 min-w-[120px] rounded border border-gray-600 bg-gray-800 py-1 shadow-lg">
            {VAT_OPTIONS.map(opt => (
              <label key={opt.value} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700">
                <input type="checkbox" checked={currentVat.includes(opt.value)} onChange={() => onVatToggle(opt.value)} className="accent-blue-500" />
                <span>{opt.label}</span>
              </label>
            ))}
            {currentVat.length > 0 && (
              <button onClick={() => { router.push(`/?${buildParams({ vat: [] })}`); setVatOpen(false); }} className="w-full px-3 py-1.5 text-left text-xs text-gray-400 hover:text-white">
                Clear VAT
              </button>
            )}
          </div>
        )}
      </div>

      {/* Fuel multi-select dropdown */}
      <div className="relative" ref={fuelRef}>
        <button
          onClick={() => setFuelOpen(o => !o)}
          className={`flex h-8 items-center gap-1.5 rounded border px-3 text-sm text-white transition-colors ${
            currentFuels.length > 0 ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 bg-gray-800 hover:border-gray-400'
          }`}
        >
          {currentFuels.length === 0 ? 'Fuel' : `Fuel (${currentFuels.length})`}
          <span className="text-gray-400">{fuelOpen ? '▲' : '▼'}</span>
        </button>
        {fuelOpen && (
          <div className="absolute left-0 top-9 z-30 min-w-[160px] rounded border border-gray-600 bg-gray-800 py-1 shadow-lg">
            {allFuels.map(f => (
              <label key={f} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700">
                <input type="checkbox" checked={currentFuels.includes(f)} onChange={() => onFuelToggle(f)} className="accent-blue-500" />
                <span>{f}</span>
              </label>
            ))}
            {currentFuels.length > 0 && (
              <button onClick={() => { router.push(`/?${buildParams({ fuel: [] })}`); setFuelOpen(false); }} className="w-full px-3 py-1.5 text-left text-xs text-gray-400 hover:text-white">
                Clear Fuel
              </button>
            )}
          </div>
        )}
      </div>

      {/* Year multi-select dropdown */}
      <div className="relative" ref={yearRef}>
        <button
          onClick={() => setYearOpen(o => !o)}
          className={`flex h-8 items-center gap-1.5 rounded border px-3 text-sm text-white transition-colors ${
            currentYears.length > 0
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-gray-600 bg-gray-800 hover:border-gray-400'
          }`}
        >
          {currentYears.length === 0 ? 'All Years' : currentYears.length === 1 ? currentYears[0] : `${currentYears.length} years`}
          <span className="text-gray-400">{yearOpen ? '▲' : '▼'}</span>
        </button>
        {yearOpen && (
          <div className="absolute left-0 top-9 z-30 min-w-[120px] rounded border border-gray-600 bg-gray-800 py-1 shadow-lg">
            {allYears.map(y => (
              <label key={y} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700">
                <input type="checkbox" checked={currentYears.includes(y)} onChange={() => onYearToggle(y)} className="accent-blue-500" />
                <span>{y}</span>
              </label>
            ))}
            {currentYears.length > 0 && (
              <button onClick={() => { router.push(`/?${buildParams({ year: [] })}`); setYearOpen(false); }} className="w-full px-3 py-1.5 text-left text-xs text-gray-400 hover:text-white">
                Clear years
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dealer dropdown (multi-select) */}
      <div className="relative" ref={dealerRef}>
        <button
          onClick={() => setDealerOpen(o => !o)}
          className={`flex h-8 items-center gap-1.5 rounded border px-3 text-sm text-white transition-colors ${
            currentDealers.length > 0
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-gray-600 bg-gray-800 hover:border-gray-400'
          }`}
        >
          {dealerLabel}
          <span className="text-gray-400">{dealerOpen ? '▲' : '▼'}</span>
        </button>
        {dealerOpen && (
          <div className="absolute left-0 top-9 z-30 min-w-[180px] rounded border border-gray-600 bg-gray-800 py-1 shadow-lg">
            {allDealers.map((d) => {
              const checked = currentDealers.includes(d.slug);
              return (
                <label
                  key={d.slug}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onDealerToggle(d.slug)}
                    className="accent-blue-500"
                  />
                  <span>{d.name}</span>
                  {Boolean(d.own) && (
                    <span className="ml-auto rounded-full bg-emerald-700 px-1.5 text-[10px] text-emerald-100">own</span>
                  )}
                </label>
              );
            })}
            {currentDealers.length > 0 && (
              <button
                onClick={() => { onDealerToggle(''); router.push(`/?${buildParams({ dealer: [] })}`); setDealerOpen(false); }}
                className="w-full px-3 py-1.5 text-left text-xs text-gray-400 hover:text-white"
              >
                Clear dealers
              </button>
            )}
          </div>
        )}
      </div>

      {/* Price range slider */}
      {priceRange && (
        <RangeFilter min={priceRange.min} max={priceRange.max} paramLow="p_min" paramHigh="p_max"
          fmt={v => `€${(v/1000).toFixed(0)}k`} />
      )}

      {/* Price change slider */}
      {priceChangeRange && (
        <PriceChangeFilter min={priceChangeRange.min} max={priceChangeRange.max} />
      )}

      {/* Clear all — always visible */}
      <button
        onClick={onClearAll}
        disabled={!hasFilters}
        className="h-8 rounded border border-gray-600 px-3 text-xs text-gray-400 hover:border-gray-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
      >
        ✕ Clear all
      </button>

      <div className="ml-auto text-sm text-gray-400">
        {total.toLocaleString()} listing{total !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
