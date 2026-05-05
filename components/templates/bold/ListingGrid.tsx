"use client";
import Link from "next/link";
import { getListingThumbSrc } from "@/lib/listing-thumb";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import type { ListingGridProps } from "../types";
import { fmtPrice, fmtMileage, filterHref } from "../utils";
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
            <select className={s.filterSelect} defaultValue={filters.make ?? ""}
              onChange={(e) => { window.location.href = filterHref(base, filters, { make: e.target.value, page: 1 }); }}>
              <option value="">All Makes</option>
              {makes.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className={s.filterGroup}>
            <label className={s.filterLabel}>Fuel</label>
            <select className={s.filterSelect} defaultValue={filters.fuel ?? ""}
              onChange={(e) => { window.location.href = filterHref(base, filters, { fuel: e.target.value, page: 1 }); }}>
              <option value="">Any</option>
              <option value="Бензин">Petrol</option>
              <option value="Дизел">Diesel</option>
              <option value="Електрически">Electric</option>
              <option value="Хибрид">Hybrid</option>
            </select>
          </div>
          <div className={s.filterGroup}>
            <label className={s.filterLabel}>Year</label>
            <div className={s.rangeRow}>
              <input className={s.filterInput} placeholder="From" defaultValue={filters.yearFrom ?? ""}
                onBlur={(e) => { if (e.target.value) window.location.href = filterHref(base, filters, { yearFrom: e.target.value, page: 1 }); }} />
              <input className={s.filterInput} placeholder="To" defaultValue={filters.yearTo ?? ""}
                onBlur={(e) => { if (e.target.value) window.location.href = filterHref(base, filters, { yearTo: e.target.value, page: 1 }); }} />
            </div>
          </div>
          <div className={s.filterGroup}>
            <label className={s.filterLabel}>Max Price (лв)</label>
            <input className={s.filterInput} placeholder="e.g. 50000" defaultValue={filters.priceMax ?? ""}
              onBlur={(e) => { if (e.target.value) window.location.href = filterHref(base, filters, { priceMax: Number(e.target.value), page: 1 }); }} />
          </div>
        </aside>

        <div>
          <div className={s.listHeader}>
            <div><span className={s.listTitle}>Available Cars</span><span className={s.listCount}>{total} results</span></div>
            <select className={s.sortSelect} defaultValue={filters.sort ?? "newest"}
              onChange={(e) => { window.location.href = filterHref(base, filters, { sort: e.target.value, page: 1 }); }}>
              <option value="newest">Newest First</option>
              <option value="price_asc">Price ↑</option>
              <option value="price_desc">Price ↓</option>
              <option value="mileage_asc">Mileage ↑</option>
              <option value="year_desc">Year ↓</option>
            </select>
          </div>

          <div className={s.grid}>
            {listings.map((l, i) => {
              const thumb = getListingThumbSrc({ mobile_id: l.mobileId, thumb_keys: l.thumbKeys, full_keys: l.fullKeys, image_meta: l.imageMeta, images_downloaded: l.imagesDownloaded, thumb_saved: l.thumbSaved });
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

          {totalPages > 1 && (
            <div className={s.pagination}>
              {page > 1 && <Link href={filterHref(base, filters, { page: page - 1 })} className={s.pageBtn}>←</Link>}
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
                <Link key={p} href={filterHref(base, filters, { page: p })} className={`${s.pageBtn} ${p === page ? s.pageBtnActive : ""}`}>{p}</Link>
              ))}
              {page < totalPages && <Link href={filterHref(base, filters, { page: page + 1 })} className={s.pageBtn}>→</Link>}
            </div>
          )}
        </div>
      </div>

      <footer className={s.footer}>
        <span className={s.footerAccent}>{dealer.name}</span>
        {dealer.publicDomain && ` · ${dealer.publicDomain}`}
      </footer>
    </div>
  );
}
