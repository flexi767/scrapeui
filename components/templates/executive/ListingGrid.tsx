"use client";
import Link from "next/link";
import { getListingThumbSrc } from "@/lib/listing-thumb";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import type { ListingGridProps, PublicListingFilters } from "../types";
import s from "./ListingGrid.module.css";

function fmtPrice(p: number | null) { return p ? p.toLocaleString("bg-BG") + " лв" : "—"; }
function fmtMileage(m: number | null) { return m ? m.toLocaleString("bg-BG") + " km" : "—"; }
function filterHref(base: string, f: PublicListingFilters, u: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  const m = { ...f, ...u };
  if (m.make) p.set("make", String(m.make));
  if (m.fuel) p.set("fuel", String(m.fuel));
  if (m.sort && m.sort !== "newest") p.set("sort", String(m.sort));
  if (m.page && Number(m.page) > 1) p.set("page", String(m.page));
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

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
          <select className={s.filterSelect} value={filters.make ?? ""} onChange={(e) => { window.location.href = filterHref(base, filters, { make: e.target.value || undefined, page: 1 }); }}>
            <option value="">All Makes</option>
            {makes.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className={s.filterSelect} value={filters.fuel ?? ""} onChange={(e) => { window.location.href = filterHref(base, filters, { fuel: e.target.value || undefined, page: 1 }); }}>
            <option value="">All Fuels</option>
            <option value="Бензин">Petrol</option>
            <option value="Дизел">Diesel</option>
            <option value="Електрически">Electric</option>
            <option value="Хибрид">Hybrid</option>
          </select>
          <select className={s.sortSelect} defaultValue={filters.sort ?? "newest"}
            onChange={(e) => { window.location.href = filterHref(base, filters, { sort: e.target.value }); }}>
            <option value="newest">Newest</option>
            <option value="price_asc">Price ↑</option>
            <option value="price_desc">Price ↓</option>
          </select>
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
          {listings.map((l) => {
            const thumb = getListingThumbSrc({ mobile_id: l.mobileId, thumb_keys: l.thumbKeys, full_keys: l.fullKeys, image_meta: l.imageMeta, images_downloaded: l.imagesDownloaded, thumb_saved: l.thumbSaved });
            return (
              <Link key={l.mobileId} href={`${base}/${l.mobileId}`} className={s.card}>
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
                  <button className={s.viewBtn}>View Details</button>
                </div>
              </Link>
            );
          })}
        </div>
        {totalPages > 1 && (
          <div className={s.pagination}>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
              <Link key={p} href={filterHref(base, filters, { page: p })} className={`${s.pageBtn} ${p === page ? s.pageBtnActive : ""}`}>{p}</Link>
            ))}
          </div>
        )}
      </div>
      <footer className={s.footer}><div className={s.footLogo}><span className={s.footLogoAccent}>{initial}</span>{dealer.name.slice(1).toUpperCase()}</div></footer>
    </div>
  );
}
