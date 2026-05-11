"use client";

import Link from "next/link";
import type { PublicListingFilters } from "./types";
import { filterHref } from "./utils";

export function MakeSelect({ base, filters, makes, className, allLabel = "All Makes" }: {
  base: string;
  filters: PublicListingFilters;
  makes: string[];
  className?: string;
  allLabel?: string;
}) {
  return (
    <select
      className={className}
      defaultValue={filters.make ?? ""}
      onChange={(e) => { window.location.href = filterHref(base, filters, { make: e.target.value, page: 1 }); }}
    >
      <option value="">{allLabel}</option>
      {makes.map((m) => <option key={m} value={m}>{m}</option>)}
    </select>
  );
}

export function FuelSelect({ base, filters, className, allLabel = "Any Fuel" }: {
  base: string;
  filters: PublicListingFilters;
  className?: string;
  allLabel?: string;
}) {
  return (
    <select
      className={className}
      defaultValue={filters.fuel ?? ""}
      onChange={(e) => { window.location.href = filterHref(base, filters, { fuel: e.target.value, page: 1 }); }}
    >
      <option value="">{allLabel}</option>
      <option value="Бензин">Petrol</option>
      <option value="Дизел">Diesel</option>
      <option value="Електрически">Electric</option>
      <option value="Хибрид">Hybrid</option>
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
  return (
    <select
      className={className}
      defaultValue={filters.sort ?? "newest"}
      onChange={(e) => { window.location.href = filterHref(base, filters, { sort: e.target.value, page: 1 }); }}
    >
      <option value="newest">Newest First</option>
      <option value="price_asc">Price ↑</option>
      <option value="price_desc">Price ↓</option>
      {includeMileage && <option value="mileage_asc">Mileage ↑</option>}
      {includeYear && <option value="year_desc">Year ↓</option>}
    </select>
  );
}

export function PriceMaxInput({ base, filters, className }: {
  base: string;
  filters: PublicListingFilters;
  className?: string;
}) {
  return (
    <input
      className={className}
      placeholder="e.g. 50000"
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
  return (
    <div className={rowClassName}>
      <input
        className={inputClassName}
        placeholder="From"
        defaultValue={filters.yearFrom ?? ""}
        onBlur={(e) => { if (e.target.value) window.location.href = filterHref(base, filters, { yearFrom: e.target.value, page: 1 }); }}
      />
      <input
        className={inputClassName}
        placeholder="To"
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
