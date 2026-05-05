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
  const initial = dealer.name.charAt(0);
  const rest = dealer.name.slice(1);

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.logoWrap}>
          <div className={s.logoIcon}>{initial}</div>
          <div className={s.logoName}><span className={s.logoAccent}>{initial}</span>{rest}</div>
        </div>
        <a href="#contact" className={s.headerCta}>Contact Us</a>
      </header>

      <div className={s.hero}>
        <div className={s.heroBg} style={{ backgroundImage: "url('https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1400&h=500&fit=crop')" }} />
        <div className={s.heroOverlay} />
        <div className={s.heroContent}>
          <div className={s.heroBadge}>{total} vehicles available</div>
          <h1 className={s.heroTitle}>{dealer.name}</h1>
        </div>
      </div>

      <div className={s.body}>
        <div className={s.searchStrip}>
          <select className={s.searchSelect} defaultValue={filters.make ?? ""}
            onChange={(e) => { window.location.href = filterHref(base, filters, { make: e.target.value, page: 1 }); }}>
            <option value="">All Makes</option>
            {makes.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className={s.searchSelect} defaultValue={filters.fuel ?? ""}
            onChange={(e) => { window.location.href = filterHref(base, filters, { fuel: e.target.value, page: 1 }); }}>
            <option value="">Any Fuel</option>
            <option value="Бензин">Petrol</option>
            <option value="Дизел">Diesel</option>
            <option value="Електрически">Electric</option>
            <option value="Хибрид">Hybrid</option>
          </select>
          <select className={s.searchSelect} defaultValue={filters.sort ?? "newest"}
            onChange={(e) => { window.location.href = filterHref(base, filters, { sort: e.target.value, page: 1 }); }}>
            <option value="newest">Newest First</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
            <option value="year_desc">Year ↓</option>
          </select>
        </div>

        <div className={s.sectionHead}>
          <div className={s.sectionTitle}>Available Vehicles</div>
          <div className={s.sectionCount}>{total} results</div>
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

        <div className={s.trustBar}>
          <div className={s.trustItem}>
            <div className={s.trustIcon}>🚗</div>
            <div className={s.trustVal}>{total}+</div>
            <div className={s.trustLbl}>Vehicles</div>
          </div>
          <div className={s.trustItem}>
            <div className={s.trustIcon}>✅</div>
            <div className={s.trustVal}>Inspected</div>
            <div className={s.trustLbl}>All cars checked</div>
          </div>
          <div className={s.trustItem}>
            <div className={s.trustIcon}>📞</div>
            <div className={s.trustVal}>Support</div>
            <div className={s.trustLbl}>Here to help</div>
          </div>
        </div>
      </div>

      <footer className={s.footer}>
        <span className={s.footerAccent}>{dealer.name}</span>
        {dealer.publicDomain && ` · ${dealer.publicDomain}`}
      </footer>
    </div>
  );
}
