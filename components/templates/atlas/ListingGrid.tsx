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
        <div className={s.logo}>{dealer.name}</div>
      </header>

      <div className={s.filterBar}>
        <select defaultValue={filters.make ?? ""}
          onChange={(e) => { window.location.href = filterHref(base, filters, { make: e.target.value, page: 1 }); }}>
          <option value="">All Makes</option>
          {makes.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select defaultValue={filters.fuel ?? ""}
          onChange={(e) => { window.location.href = filterHref(base, filters, { fuel: e.target.value, page: 1 }); }}>
          <option value="">Any Fuel</option>
          <option value="Бензин">Petrol</option>
          <option value="Дизел">Diesel</option>
          <option value="Електрически">Electric</option>
          <option value="Хибрид">Hybrid</option>
        </select>
        <select defaultValue={filters.sort ?? "newest"}
          onChange={(e) => { window.location.href = filterHref(base, filters, { sort: e.target.value, page: 1 }); }}>
          <option value="newest">Newest First</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
          <option value="year_desc">Year ↓</option>
        </select>
        <div className={s.filterCount}>{total} vehicles</div>
      </div>

      <div className={s.grid}>
        {listings.map((l, idx) => {
          const thumb = getListingThumbSrc({ mobile_id: l.mobileId, thumb_keys: l.thumbKeys, full_keys: l.fullKeys, image_meta: l.imageMeta, images_downloaded: l.imagesDownloaded, thumb_saved: l.thumbSaved });
          const isFeatured = idx === 0;
          return (
            <Link key={l.mobileId} href={`${base}/${l.mobileId}`} className={`${s.card} ${isFeatured ? s.cardFeatured : ""}`}>
              <div className={s.cardImg}>
                {thumb ? <ImageWithFallback src={thumb} alt="Vehicle photo" fallbackLabel="No image" /> : <div className={s.cardImgPlaceholder}>🚗</div>}
                <div className={s.priceOverlay}>
                  <span className={s.overlayPrice}>{fmtPrice(l.currentPrice)}</span>
                </div>
              </div>
              <div className={s.cardBody}>
                <div className={s.carName}>{l.make} {l.model}</div>
                <div className={s.carVariant}>{l.regYear} · {l.fuel ?? ""}</div>
                <div className={s.cardSpecs}>
                  {l.mileage != null && <span>{fmtMileage(l.mileage)}</span>}
                  {l.transmission && <span>{l.transmission}</span>}
                </div>
              </div>
              <div className={s.cardFoot}>
                <span className={s.viewLink}>View →</span>
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

      <footer className={s.footer}>
        <span className={s.footLogo}>{dealer.name}</span>
        <span>{dealer.publicDomain ?? ""}</span>
      </footer>
    </div>
  );
}
