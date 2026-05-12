"use client";
import Link from "next/link";
import { getPublicThumbSrc } from "../utils";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import type { ListingGridProps } from "../types";
import { fmtPrice, fmtMileage } from "../utils";
import { MakeSelect, FuelSelect, SortSelect, PriceMaxInput, YearRangeInputs, Pagination } from "../FilterBar";
import s from "./ListingGrid.module.css";

export function ListingGrid({ dealer, listings, total, page, limit, makes, filters }: ListingGridProps) {
  const base = `/d/${dealer.slug}`;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.logo}>
          {dealer.name.slice(0, Math.ceil(dealer.name.length / 2))}
          <span className={s.logoAccent}>{dealer.name.slice(Math.ceil(dealer.name.length / 2))}</span>
        </div>
        <a href="#contact" className={s.headerCta}>Contact</a>
      </header>

      <div className={s.hero}>
        <div className={s.heroInner}>
          <h1 className={s.heroTitle}>Find Your Perfect <span className={s.heroAccent}>Ride.</span></h1>
          <p className={s.heroSub}>{total} vehicles available from {dealer.name}</p>
        </div>
      </div>

      <div className={s.body}>
        <aside className={s.sidebar}>
          <div className={s.sidebarTitle}>Filters</div>
          <div className={s.filterGroup}>
            <label className={s.filterLabel}>Make</label>
            <MakeSelect base={base} filters={filters} makes={makes} className={s.filterSelect} />
          </div>
          <div className={s.filterGroup}>
            <label className={s.filterLabel}>Fuel</label>
            <FuelSelect base={base} filters={filters} className={s.filterSelect} allLabel="Any" />
          </div>
          <div className={s.filterGroup}>
            <label className={s.filterLabel}>Year</label>
            <YearRangeInputs base={base} filters={filters} inputClassName={s.filterInput} rowClassName={s.rangeRow} />
          </div>
          <div className={s.filterGroup}>
            <label className={s.filterLabel}>Max Price (лв)</label>
            <PriceMaxInput base={base} filters={filters} className={s.filterInput} />
          </div>
        </aside>

        <div>
          <div className={s.listHeader}>
            <div><span className={s.listTitle}>Available Cars</span><span className={s.listCount}>{total} results</span></div>
            <SortSelect base={base} filters={filters} className={s.sortSelect} includeMileage />
          </div>

          <div className={s.grid}>
            {listings.map((l, i) => {
              const thumb = getPublicThumbSrc(l);
              return (
                <Link key={l.mobileId ?? i} href={`${base}/${l.mobileId}`} className={s.card}>
                  <div className={s.cardImg}>
                    {thumb ? <ImageWithFallback src={thumb} alt="Vehicle photo" fallbackLabel="No image" /> : <div className={s.cardImgPlaceholder}>🚗</div>}
                    {l.isNew === 1 && <span className={s.badgeNew}>New</span>}
                  </div>
                  <div className={s.cardBody}>
                    <div className={s.carName}>{l.make} {l.model}</div>
                    <div className={s.carSub}>{l.regYear}</div>
                    <div className={s.specs}>
                      {l.fuel && <span className={s.spec}>{l.fuel}</span>}
                      {l.mileage != null && <span className={s.spec}>{fmtMileage(l.mileage)}</span>}
                      {l.transmission && <span className={s.spec}>{l.transmission}</span>}
                    </div>
                    <div className={s.cardFoot}>
                      <div className={s.price}>{fmtPrice(l.currentPrice)}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <Pagination
            page={page} totalPages={totalPages} base={base} filters={filters}
            wrapperClassName={s.pagination} btnClassName={s.pageBtn} btnActiveClassName={s.pageBtnActive}
          />
        </div>
      </div>

      <footer className={s.footer}>
        <span className={s.footerAccent}>{dealer.name}</span>
        {dealer.publicDomain && ` · ${dealer.publicDomain}`}
      </footer>
    </div>
  );
}
