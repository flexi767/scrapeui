"use client";
import Link from "next/link";
import { getPublicThumbSrc } from "../utils";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import type { ListingGridProps } from "../types";
import { fmtPrice, fmtMileage } from "../utils";
import { MakeSelect, FuelSelect, SortSelect, Pagination } from "../FilterBar";
import s from "./ListingGrid.module.css";

export function ListingGrid({ dealer, listings, total, page, limit, makes, filters }: ListingGridProps) {
  const base = `/d/${dealer.slug}`;
  const totalPages = Math.ceil(total / limit);
  const initial = dealer.name.charAt(0);

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.logoWrap}>
          <div className={s.logoMark}>{initial}</div>
          <div className={s.logoText}><span className={s.logoAccent}>{initial}</span>{dealer.name.slice(1).toUpperCase()}</div>
        </div>
        <div className={s.headerFilters}>
          <MakeSelect base={base} filters={filters} makes={makes} className={s.filterSelect} />
          <FuelSelect base={base} filters={filters} className={s.filterSelect} allLabel="All Fuels" />
          <SortSelect base={base} filters={filters} className={s.sortSelect} includeYear={false} />
        </div>
      </header>

      <div className={s.hero}>
        <div className={s.heroContent}>
          <div className={s.heroEyebrow}>{dealer.name} Collection</div>
          <h1 className={s.heroTitle}>Drive with <em className={s.heroTitleEm}>distinction.</em></h1>
        </div>
      </div>

      <div className={s.body}>
        <div className={s.sectionLabel}>Our Collection</div>
        <div className={s.sectionTitle}>
          Available Vehicles <span className={s.sectionCount}>{total} results</span>
        </div>
        <div className={s.list}>
          {listings.map((l, i) => {
            const thumb = getPublicThumbSrc(l);
            return (
              <Link key={l.mobileId ?? i} href={`${base}/${l.mobileId}`} className={s.card}>
                <div className={s.cardImg}>
                  {thumb ? <ImageWithFallback src={thumb} alt="Vehicle photo" fallbackLabel="No image" /> : <div className={s.cardImgPlaceholder}>🚗</div>}
                </div>
                <div className={s.cardBody}>
                  <div className={s.carName}>{l.make} {l.model}</div>
                  <div className={s.carVariant}>{l.regYear} · {l.fuel ?? ""} · {l.transmission ?? ""}</div>
                  <div className={s.specs}>
                    {l.mileage != null && <div><div className={s.specVal}>{fmtMileage(l.mileage)}</div><div className={s.specLbl}>km</div></div>}
                    {l.fuel && <div><div className={s.specVal}>{l.fuel}</div><div className={s.specLbl}>Fuel</div></div>}
                    {l.transmission && <div><div className={s.specVal}>{l.transmission}</div><div className={s.specLbl}>Gearbox</div></div>}
                  </div>
                </div>
                <div className={s.cardCta}>
                  <div className={s.price}>{fmtPrice(l.currentPrice)}<span className={s.priceLabel}>Incl. VAT</span></div>
                  <span className={s.viewBtn}>View Details</span>
                </div>
              </Link>
            );
          })}
        </div>
        <Pagination
          page={page} totalPages={totalPages} base={base} filters={filters}
          wrapperClassName={s.pagination} btnClassName={s.pageBtn} btnActiveClassName={s.pageBtnActive}
          showArrows={false}
        />
      </div>
      <footer className={s.footer}><div className={s.footLogo}><span className={s.footLogoAccent}>{initial}</span>{dealer.name.slice(1).toUpperCase()}</div></footer>
    </div>
  );
}
