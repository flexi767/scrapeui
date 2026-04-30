"use client";
import Link from "next/link";
import { getListingThumbSrc } from "@/lib/listing-thumb";
import type { ListingGridProps, PublicListingFilters } from "../types";
import s from "./ListingGrid.module.css";

function fmtPrice(p: number | null) { return p ? p.toLocaleString("bg-BG") + " лв" : "—"; }
function fmtMileage(m: number | null) { return m ? m.toLocaleString("bg-BG") + " km" : "—"; }
function filterHref(base: string, f: PublicListingFilters, u: Record<string, string | number | undefined>) {
  const p = new URLSearchParams();
  const m = { ...f, ...u };
  if (m.make) p.set("make", String(m.make));
  if (m.fuel) p.set("fuel", String(m.fuel));
  if (m.yearFrom) p.set("yearFrom", String(m.yearFrom));
  if (m.yearTo) p.set("yearTo", String(m.yearTo));
  if (m.priceMin) p.set("priceMin", String(m.priceMin));
  if (m.priceMax) p.set("priceMax", String(m.priceMax));
  if (m.sort && m.sort !== "newest") p.set("sort", String(m.sort));
  if (m.page && Number(m.page) > 1) p.set("page", String(m.page));
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

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
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <span className={s.logoBadge}>PRO</span>
          <span className={s.logoName}>{dealer.name}</span>
        </div>
        <a href="#contact" className={s.headerEnquire}>Enquire</a>
      </header>

      <div className={s.toolbar}>
        <select className={s.toolbarSelect} defaultValue={filters.make ?? ""}
          onChange={(e) => { window.location.href = filterHref(base, filters, { make: e.target.value, page: 1 }); }}>
          <option value="">All Makes</option>
          {makes.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className={s.toolbarSelect} defaultValue={filters.fuel ?? ""}
          onChange={(e) => { window.location.href = filterHref(base, filters, { fuel: e.target.value, page: 1 }); }}>
          <option value="">Any Fuel</option>
          <option value="Бензин">Petrol</option>
          <option value="Дизел">Diesel</option>
          <option value="Електрически">Electric</option>
          <option value="Хибрид">Hybrid</option>
        </select>
        <select className={s.toolbarSelect} defaultValue={filters.sort ?? "newest"}
          onChange={(e) => { window.location.href = filterHref(base, filters, { sort: e.target.value, page: 1 }); }}>
          <option value="newest">Newest First</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
          <option value="mileage_asc">Mileage ↑</option>
          <option value="year_desc">Year ↓</option>
        </select>
        <div className={s.toolbarSpacer} />
        <div className={s.toolbarCount}>{total} vehicles</div>
      </div>

      <div className={s.main}>
        <aside className={s.sidebar}>
          <div className={s.sbTitle}>Filters</div>
          <div className={s.sbSection}>
            <label>Make</label>
            <select className={s.sbSelect} defaultValue={filters.make ?? ""}
              onChange={(e) => { window.location.href = filterHref(base, filters, { make: e.target.value, page: 1 }); }}>
              <option value="">All</option>
              {makes.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className={s.sbSection}>
            <label>Max Price</label>
            <input className={s.sbInput} placeholder="e.g. 50000" defaultValue={filters.priceMax ?? ""}
              onBlur={(e) => { if (e.target.value) window.location.href = filterHref(base, filters, { priceMax: Number(e.target.value), page: 1 }); }} />
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
            {listings.map((l) => {
              const thumb = getListingThumbSrc({ mobile_id: l.mobileId, thumb_keys: l.thumbKeys, full_keys: l.fullKeys, image_meta: l.imageMeta, images_downloaded: l.imagesDownloaded, thumb_saved: l.thumbSaved });
              return (
                <Link key={l.mobileId} href={`${base}/${l.mobileId}`} className={s.row}>
                  <div className={s.rowCarCol}>
                    <div className={s.thumb}>
                      {thumb ? <img src={thumb} alt={`${l.make} ${l.model}`} /> : <div className={s.thumbPlaceholder}>🚗</div>}
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
                  <div><button className={s.viewBtn}>View →</button></div>
                </Link>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className={s.pagination}>
              <div className={s.pageInfo}>Showing {startItem}–{endItem} of {total} vehicles</div>
              <div className={s.pageBtns}>
                {page > 1 && <Link href={filterHref(base, filters, { page: page - 1 })} className={s.pageBtn}>←</Link>}
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
                  <Link key={p} href={filterHref(base, filters, { page: p })} className={`${s.pageBtn} ${p === page ? s.pageBtnActive : ""}`}>{p}</Link>
                ))}
                {page < totalPages && <Link href={filterHref(base, filters, { page: page + 1 })} className={s.pageBtn}>→</Link>}
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className={s.footer}>
        <span className={s.footLogo}>{dealer.name}</span>
        <span>{dealer.publicDomain ?? ""}</span>
      </footer>
    </div>
  );
}
