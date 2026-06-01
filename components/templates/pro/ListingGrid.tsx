"use client";
import Link from "next/link";
import { getPublicThumbSrc } from "../utils";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import type { ListingGridProps } from "../types";
import { fmtPrice, fmtMileage, filterHref } from "../utils";
import { MakeSelect, FuelSelect, SortSelect, PriceMaxInput, Pagination } from "../FilterBar";
import { Shell } from "./Shell";
import s from "./ListingGrid.module.css";

function fuelBadgeClass(fuel: string | null): string {
  if (!fuel) return s.fuelOther;
  if (fuel.includes("Бензин")) return s.fuelPetrol;
  if (fuel.includes("Дизел")) return s.fuelDiesel;
  if (fuel.includes("Хибрид")) return s.fuelHybrid;
  if (fuel.includes("Електр")) return s.fuelElectric;
  return s.fuelOther;
}

export function ListingGrid({ dealer, listings, total, page, limit, makes, filters }: ListingGridProps) {
  const base = `/d/${dealer.slug}`;
  const totalPages = Math.ceil(total / limit);
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <Shell dealer={dealer} current="cars">
      <div className={s.toolbar}>
        <MakeSelect base={base} filters={filters} makes={makes} className={s.toolbarSelect} />
        <FuelSelect base={base} filters={filters} className={s.toolbarSelect} allLabel="Any Fuel" />
        <SortSelect base={base} filters={filters} className={s.toolbarSelect} includeMileage />
        <div className={s.toolbarSpacer} />
        <div className={s.toolbarCount}>{total} vehicles</div>
      </div>

      <div className={s.main}>
        <aside className={s.sidebar}>
          <div className={s.sbTitle}>Filters</div>
          <div className={s.sbSection}>
            <label>Make</label>
            <MakeSelect base={base} filters={filters} makes={makes} className={s.sbSelect} allLabel="All" />
          </div>
          <div className={s.sbSection}>
            <label>Max Price</label>
            <PriceMaxInput base={base} filters={filters} className={s.sbInput} />
          </div>
          <div className={s.sbSection}>
            <label>Year From</label>
            <input className={s.sbInput} placeholder="e.g. 2018" defaultValue={filters.yearFrom ?? ""}
              onBlur={(e) => { if (e.target.value) window.location.href = filterHref(base, filters, { yearFrom: e.target.value, page: 1 }); }} />
          </div>
        </aside>

        <div>
          <div className={s.table}>
            <div className={s.thead}>
              <div className={s.th}>Vehicle</div>
              <div className={s.th}>Details</div>
              <div className={s.th}>Price</div>
              <div className={s.th}>Mileage</div>
              <div className={s.th}>Fuel</div>
              <div className={s.th}></div>
            </div>
            {listings.map((l, i) => {
              const thumb = getPublicThumbSrc(l);
              return (
                <Link key={l.mobileId ?? i} href={`${base}/${l.mobileId}`} className={s.row}>
                  <div className={s.rowCarCol}>
                    <div className={s.thumb}>
                      {thumb ? <ImageWithFallback src={thumb} alt="Vehicle photo" fallbackLabel="No image" /> : <div className={s.thumbPlaceholder}>🚗</div>}
                    </div>
                    <div>
                      <div className={s.carName}>{l.make} {l.model}</div>
                      <div className={s.carVariant}>{l.regYear}</div>
                    </div>
                  </div>
                  <div className={s.cellGray}>{l.transmission ?? "—"}</div>
                  <div className={s.cellPrice}>{fmtPrice(l.currentPrice)}</div>
                  <div className={s.cellGray}>{fmtMileage(l.mileage)}</div>
                  <div>
                    {l.fuel && <span className={`${s.fuelBadge} ${fuelBadgeClass(l.fuel)}`}>{l.fuel}</span>}
                  </div>
                  <div><span className={s.viewBtn}>View →</span></div>
                </Link>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className={s.pagination}>
              <div className={s.pageInfo}>Showing {startItem}–{endItem} of {total} vehicles</div>
              <Pagination
                page={page} totalPages={totalPages} base={base} filters={filters}
                wrapperClassName={s.pageBtns} btnClassName={s.pageBtn} btnActiveClassName={s.pageBtnActive}
              />
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
