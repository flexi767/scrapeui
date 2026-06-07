"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { PublicListingFilters } from "./types";
import { filterHref } from "./utils";

export function MakeSelect({ base, filters, makes, className, allLabel }: {
  base: string;
  filters: PublicListingFilters;
  makes: string[];
  className?: string;
  allLabel?: string;
}) {
  const t = useTranslations('ui');
  return (
    <select
      className={className}
      defaultValue={filters.make ?? ""}
      onChange={(e) => { window.location.href = filterHref(base, filters, { make: e.target.value, page: 1 }); }}
    >
      <option value="">{allLabel ?? t('all_makes')}</option>
      {makes.map((m) => <option key={m} value={m}>{m}</option>)}
    </select>
  );
}

export function FuelSelect({ base, filters, className, allLabel }: {
  base: string;
  filters: PublicListingFilters;
  className?: string;
  allLabel?: string;
}) {
  const t = useTranslations('ui');
  return (
    <select
      className={className}
      defaultValue={filters.fuel ?? ""}
      onChange={(e) => { window.location.href = filterHref(base, filters, { fuel: e.target.value, page: 1 }); }}
    >
      <option value="">{allLabel ?? t('any_fuel')}</option>
      <option value="Бензин">{t('fuel_petrol')}</option>
      <option value="Дизел">{t('fuel_diesel')}</option>
      <option value="Електрически">{t('fuel_electric')}</option>
      <option value="Хибрид">{t('fuel_hybrid')}</option>
    </select>
  );
}

export function SortSelect({ base, filters, className, includeMileage = false, includeYear = true }: {
  base: string;
  filters: PublicListingFilters;
  className?: string;
  includeMileage?: boolean;
  includeYear?: boolean;
}) {
  const t = useTranslations('ui');
  return (
    <select
      className={className}
      defaultValue={filters.sort ?? "newest"}
      onChange={(e) => { window.location.href = filterHref(base, filters, { sort: e.target.value, page: 1 }); }}
    >
      <option value="newest">{t('sort_newest_first')}</option>
      <option value="price_asc">{t('sort_price_asc')}</option>
      <option value="price_desc">{t('sort_price_desc')}</option>
      {includeMileage && <option value="mileage_asc">{t('sort_mileage_asc')}</option>}
      {includeYear && <option value="year_desc">{t('sort_year_desc')}</option>}
    </select>
  );
}

export function PriceMaxInput({ base, filters, className }: {
  base: string;
  filters: PublicListingFilters;
  className?: string;
}) {
  const t = useTranslations('ui');
  return (
    <input
      className={className}
      placeholder={t('price_max_placeholder')}
      defaultValue={filters.priceMax ?? ""}
      onBlur={(e) => {
        if (e.target.value) window.location.href = filterHref(base, filters, { priceMax: Number(e.target.value), page: 1 });
      }}
    />
  );
}

export function YearRangeInputs({ base, filters, inputClassName, rowClassName }: {
  base: string;
  filters: PublicListingFilters;
  inputClassName?: string;
  rowClassName?: string;
}) {
  const t = useTranslations('ui');
  return (
    <div className={rowClassName}>
      <input
        className={inputClassName}
        placeholder={t('year_from')}
        defaultValue={filters.yearFrom ?? ""}
        onBlur={(e) => { if (e.target.value) window.location.href = filterHref(base, filters, { yearFrom: e.target.value, page: 1 }); }}
      />
      <input
        className={inputClassName}
        placeholder={t('year_to')}
        defaultValue={filters.yearTo ?? ""}
        onBlur={(e) => { if (e.target.value) window.location.href = filterHref(base, filters, { yearTo: e.target.value, page: 1 }); }}
      />
    </div>
  );
}

export function Pagination({ page, totalPages, base, filters, wrapperClassName, btnClassName, btnActiveClassName, showArrows = true }: {
  page: number;
  totalPages: number;
  base: string;
  filters: PublicListingFilters;
  wrapperClassName?: string;
  btnClassName?: string;
  btnActiveClassName?: string;
  showArrows?: boolean;
}) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1);
  return (
    <div className={wrapperClassName}>
      {showArrows && page > 1 && (
        <Link href={filterHref(base, filters, { page: page - 1 })} className={btnClassName}>←</Link>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={filterHref(base, filters, { page: p })}
          className={[btnClassName, p === page ? btnActiveClassName : undefined].filter(Boolean).join(" ") || undefined}
        >
          {p}
        </Link>
      ))}
      {showArrows && page < totalPages && (
        <Link href={filterHref(base, filters, { page: page + 1 })} className={btnClassName}>→</Link>
      )}
    </div>
  );
}
