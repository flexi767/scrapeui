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
  const nameFirst = dealer.name.charAt(0);
  const nameRest = dealer.name.slice(1);

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.logoWrap}>
          <div className={s.logoDot} />
          <div className={s.logoText}><span className={s.logoAccent}>{nameFirst}</span>{nameRest}</div>
        </div>
      </header>

      <div className={s.ticker}>
        <span><strong>{total}</strong> vehicles available</span>
        <span>Updated today</span>
        <span>{dealer.name}</span>
      </div>

      <div className={s.heroStrip}>
        <h1 className={s.heroH1}>{dealer.name}</h1>
        <p className={s.heroSub}>Browse our full inventory below</p>
      </div>

      <div className={s.main}>
        <aside className={s.sidebar}>
          <div className={s.sidebarTitle}>Filters</div>
          <div className={s.filterGroup}>
            <label className={s.filterLabel}>Make</label>
            <select className={s.filterSelect} defaultValue={filters.make ?? ""}
              onChange={(e) => { window.location.href = filterHref(base, filters, { make: e.target.value, page: 1 }); }}>
              <option value="">All</option>
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
            <label className={s.filterLabel}>Max Price</label>
            <input className={s.filterInput} placeholder="e.g. 50000" defaultValue={filters.priceMax ?? ""}
              onBlur={(e) => { if (e.target.value) window.location.href = filterHref(base, filters, { priceMax: Number(e.target.value), page: 1 }); }} />
          </div>
        </aside>

        <div>
          <div className={s.listTop}>
            <div className={s.listCount}><strong>{total}</strong> vehicles</div>
            <select className={s.sortSelect} defaultValue={filters.sort ?? "newest"}
              onChange={(e) => { window.location.href = filterHref(base, filters, { sort: e.target.value, page: 1 }); }}>
              <option value="newest">Newest</option>
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
                    {l.isNew === 1 && <span className={s.cardTag}>New</span>}
                  </div>
                  <div className={s.cardBody}>
                    <div className={s.carName}>{l.make} {l.model}</div>
                    <div className={s.carSub}>{l.regYear} · {l.fuel ?? ""}</div>
                    <div className={s.specs}>
                      {l.fuel && <span className={s.spec}>{l.fuel}</span>}
                      {l.mileage != null && <span className={s.spec}>{fmtMileage(l.mileage)}</span>}
                      {l.transmission && <span className={s.spec}>{l.transmission}</span>}
                    </div>
                    <div className={s.cardFoot}>
                      <div className={s.price}>{fmtPrice(l.currentPrice)}</div>
                      <span className={s.viewBtn}>View</span>
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
        <div className={s.footLogo}><span className={s.footLogoAccent}>{nameFirst}</span>{nameRest}</div>
        <div>{dealer.publicDomain ?? ""}</div>
      </footer>
    </div>
  );
}
