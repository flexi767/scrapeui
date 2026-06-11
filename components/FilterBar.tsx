'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import MultiSelectDropdown from './filter-bar/MultiSelectDropdown';
import PriceChangeFilter from './PriceChangeFilter';
import RangeFilter from './RangeFilter';
import { formatCount } from '@/lib/utils';

interface Props {
  makes: string[];
  makeModels: Record<string, string[]>;
  allDealers: { slug: string; name: string; own: number }[];
  allYears: string[];
  allCategories?: string[];
  allFuels?: string[];
  allExtras?: string[];
  total: number;
  priceChangeRange?: { min: number; max: number } | null;
  priceRange?: { min: number; max: number } | null;
  basePath?: string;
  showPageLinks?: boolean;
  syncHref?: string;
  syncLabel?: string;
  syncActive?: boolean;
}

export default function FilterBar({ makes, makeModels, allDealers, allYears, allCategories = [], allFuels = [], allExtras = [], total, priceChangeRange, priceRange, basePath = '/listings', showPageLinks = true, syncHref, syncLabel, syncActive = false }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('ui');
  const effectiveSyncLabel = syncLabel ?? t('sync');

  const currentMake = searchParams.get('make') ?? '';
  const currentModel = searchParams.get('model') ?? '';
  const currentDealers = searchParams.getAll('dealer');
  const currentYears = searchParams.getAll('year');
  const currentCategories = searchParams.getAll('category');
  const currentStatuses = searchParams.getAll('status');
  const currentVat = searchParams.getAll('vat');
  const currentFuels = searchParams.getAll('fuel');
  const currentExtras = searchParams.getAll('extra');
  const currentSearch = searchParams.get('search') ?? '';
  const currentSort = searchParams.get('sort') ?? 'price';
  const currentOrder = searchParams.get('order') ?? 'desc';

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buildParams(overrides: Record<string, string | string[]> = {}) {
    const p = new URLSearchParams();
    p.set('sort', currentSort);
    p.set('order', currentOrder);
    if (currentMake) p.set('make', currentMake);
    if (currentModel) p.set('model', currentModel);
    for (const d of currentDealers) p.append('dealer', d);
    for (const y of currentYears) p.append('year', y);
    for (const c of currentCategories) p.append('category', c);
    for (const s of currentStatuses) p.append('status', s);
    for (const v of currentVat) p.append('vat', v);
    for (const f of currentFuels) p.append('fuel', f);
    for (const e of currentExtras) p.append('extra', e);
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
    router.push(`${basePath}?${buildParams({ make, model: '' })}`);
  }

  function onModelChange(model: string) {
    router.push(`${basePath}?${buildParams({ model })}`);
  }

  function onDealerToggle(slug: string) {
    const next = currentDealers.includes(slug)
      ? currentDealers.filter((d) => d !== slug)
      : [...currentDealers, slug];
    router.push(`${basePath}?${buildParams({ dealer: next })}`);
  }

  function onSearchChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.push(`${basePath}?${buildParams({ search: value })}`);
    }, 350);
  }

  function onClearAll() {
    const p = new URLSearchParams();
    p.set('sort', currentSort);
    p.set('order', currentOrder);
    router.push(`${basePath}?${p.toString()}`);
  }

  const availableModels = currentMake ? (makeModels[currentMake] ?? []) : [];

  function onYearToggle(year: string) {
    const next = currentYears.includes(year)
      ? currentYears.filter(y => y !== year)
      : [...currentYears, year];
    router.push(`${basePath}?${buildParams({ year: next })}`);
  }

  function onStatusToggle(s: string) {
    const next = currentStatuses.includes(s) ? currentStatuses.filter(x => x !== s) : [...currentStatuses, s];
    router.push(`${basePath}?${buildParams({ status: next })}`);
  }

  function onCategoryToggle(category: string) {
    const next = currentCategories.includes(category)
      ? currentCategories.filter(x => x !== category)
      : [...currentCategories, category];
    router.push(`${basePath}?${buildParams({ category: next })}`);
  }

  const STATUS_OPTIONS = [
    { value: 'TOP', label: 'TOP' },
    { value: 'VIP', label: 'VIP' },
    { value: 'none', label: t('status_none') },
  ];

  function onVatToggle(v: string) {
    const next = currentVat.includes(v) ? currentVat.filter(x => x !== v) : [...currentVat, v];
    router.push(`${basePath}?${buildParams({ vat: next })}`);
  }

  const VAT_OPTIONS = [
    { value: 'included', label: t('vat_included') },
    { value: 'exempt', label: t('vat_exempt') },
    { value: 'excluded', label: t('vat_excluded') },
    { value: 'null', label: '—' },
  ];

  function onFuelToggle(f: string) {
    const next = currentFuels.includes(f) ? currentFuels.filter(x => x !== f) : [...currentFuels, f];
    router.push(`${basePath}?${buildParams({ fuel: next })}`);
  }

  function onExtraToggle(extra: string) {
    const next = currentExtras.includes(extra) ? currentExtras.filter(x => x !== extra) : [...currentExtras, extra];
    router.push(`${basePath}?${buildParams({ extra: next })}`);
  }

  const hasFilters = currentMake || currentModel || currentDealers.length > 0 || currentYears.length > 0 || currentCategories.length > 0 || currentStatuses.length > 0 || currentVat.length > 0 || currentFuels.length > 0 || currentExtras.length > 0 || currentSearch || searchParams.get('p_min') || searchParams.get('p_max') || searchParams.get('pc_min') || searchParams.get('pc_max');



  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Search */}
      <input
        key={currentSearch}
        type="search"
        placeholder={t('search_placeholder')}
        defaultValue={currentSearch}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-8 w-28 rounded border border-gray-600 bg-gray-800 px-2 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
      />

      {/* Make */}
      <select
        value={currentMake}
        onChange={(e) => onMakeChange(e.target.value)}
        className="h-8 rounded border border-gray-600 bg-gray-800 px-2 text-sm text-white focus:border-blue-500 focus:outline-none"
      >
        <option value="">{t('make')}</option>
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
        <option value="">{t('model')}</option>
        {availableModels.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>

      <MultiSelectDropdown
        buttonText={currentDealers.length === 0 ? t('dealers') : currentDealers.length === 1 ? allDealers.find(d => d.slug === currentDealers[0])?.name ?? currentDealers[0] : `${currentDealers.length} ${t('dealers_count')}`}
        clearLabel={t('clear_dealers')}
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
        buttonText={currentCategories.length === 0 ? t('body') : currentCategories.length === 1 ? currentCategories[0] : `${currentCategories.length} ${t('body_types')}`}
        clearLabel={t('clear_body')}
        options={allCategories.map((category) => ({ value: category, label: category }))}
        selectedValues={currentCategories}
        onToggle={onCategoryToggle}
        onClear={() => router.push(`${basePath}?${buildParams({ category: [] })}`)}
        minWidthClassName="min-w-[180px]"
      />

      <MultiSelectDropdown
        buttonText={currentStatuses.length === 0 ? t('paid') : currentStatuses.map(s => s.toUpperCase()).join(', ')}
        clearLabel={t('clear_paid')}
        options={STATUS_OPTIONS}
        selectedValues={currentStatuses}
        onToggle={onStatusToggle}
        onClear={() => router.push(`${basePath}?${buildParams({ status: [] })}`)}
        minWidthClassName="min-w-[120px]"
      />

      {/* Price range slider */}
      {priceRange && (
        <RangeFilter min={priceRange.min} max={priceRange.max} paramLow="p_min" paramHigh="p_max"
          fmt={v => `€${(v/1000).toFixed(0)}k`} basePath={basePath} />
      )}

      <MultiSelectDropdown
        buttonText={currentVat.length === 0 ? t('vat') : currentVat.length === 1 ? t('vat') : `${t('vat')} (${currentVat.length})`}
        clearLabel={t('clear_vat')}
        options={VAT_OPTIONS}
        selectedValues={currentVat}
        onToggle={onVatToggle}
        onClear={() => router.push(`${basePath}?${buildParams({ vat: [] })}`)}
        minWidthClassName="min-w-[120px]"
      />

      <MultiSelectDropdown
        buttonText={currentFuels.length === 0 ? t('fuel') : `${t('fuel')} (${currentFuels.length})`}
        clearLabel={t('clear_fuel')}
        options={allFuels.map((fuel) => ({ value: fuel, label: fuel }))}
        selectedValues={currentFuels}
        onToggle={onFuelToggle}
        onClear={() => router.push(`${basePath}?${buildParams({ fuel: [] })}`)}
      />

      {/* Extras multi-select dropdown */}
      {allExtras.length > 0 && (
        <MultiSelectDropdown
          buttonText={currentExtras.length === 0 ? t('extras') : `${t('extras')} (${currentExtras.length})`}
          clearLabel={t('clear_extras')}
          options={allExtras.map((extra) => ({ value: extra, label: extra }))}
          selectedValues={currentExtras}
          onToggle={onExtraToggle}
          onClear={() => router.push(`${basePath}?${buildParams({ extra: [] })}`)}
          minWidthClassName="min-w-[180px]"
        />
      )}

      <MultiSelectDropdown
        buttonText={currentYears.length === 0 ? t('years') : currentYears.length === 1 ? currentYears[0] : `${currentYears.length} ${t('years_count')}`}
        clearLabel={t('clear_years')}
        options={allYears.map((year) => ({ value: year, label: year }))}
        selectedValues={currentYears}
        onToggle={onYearToggle}
        onClear={() => router.push(`${basePath}?${buildParams({ year: [] })}`)}
        minWidthClassName="min-w-[120px]"
      />

      {/* Price change slider */}
      {priceChangeRange && (
        <PriceChangeFilter min={priceChangeRange.min} max={priceChangeRange.max} basePath={basePath} />
      )}

      {/* Clear all — always visible */}
      <button
        onClick={onClearAll}
        disabled={!hasFilters}
        className="h-8 rounded border border-gray-600 px-3 text-xs text-gray-400 hover:border-gray-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
      >
        ✕ {t('clear')}
      </button>

      <div className="ml-auto flex items-center gap-3 text-sm text-gray-400">
        <span>{formatCount(total)} {total !== 1 ? t('ads') : t('ad')}</span>
        {syncHref && (
          <a
            href={syncHref}
            className={`rounded border px-3 py-1.5 text-xs font-medium ${
              syncActive
                ? 'border-blue-500/60 bg-blue-500/10 text-blue-200 hover:bg-blue-500/15'
                : 'border-gray-700 text-gray-500 hover:text-gray-300'
            }`}
          >
            {effectiveSyncLabel}
          </a>
        )}
        {showPageLinks && (
          <>
            <Link href="/editown" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">{t('edit_own')}</Link>
            <Link href="/config" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">⚙ {t('config')}</Link>
          </>
        )}
      </div>
    </div>
  );
}
