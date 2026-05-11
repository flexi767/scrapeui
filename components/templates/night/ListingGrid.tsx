"use client";
import Link from "next/link";
import { getListingThumbSrc } from "@/lib/listing-thumb";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import type { ListingGridProps } from "../types";
import { fmtPrice, fmtMileage } from "../utils";
import { MakeSelect, FuelSelect, SortSelect, PriceMaxInput, Pagination } from "../FilterBar";
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
            <MakeSelect base={base} filters={filters} makes={makes} className={s.filterSelect} allLabel="All" />
          </div>
          <div className={s.filterGroup}>
            <label className={s.filterLabel}>Fuel</label>
            <FuelSelect base={base} filters={filters} className={s.filterSelect} allLabel="Any" />
          </div>
          <div className={s.filterGroup}>
            <label className={s.filterLabel}>Max Price</label>
            <PriceMaxInput base={base} filters={filters} className={s.filterInput} />
          </div>
        </aside>

        <div>
          <div className={s.listTop}>
            <div className={s.listCount}><strong>{total}</strong> vehicles</div>
            <SortSelect base={base} filters={filters} className={s.sortSelect} includeMileage />
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

          <Pagination
            page={page} totalPages={totalPages} base={base} filters={filters}
            wrapperClassName={s.pagination} btnClassName={s.pageBtn} btnActiveClassName={s.pageBtnActive}
          />
        </div>
      </div>

      <footer className={s.footer}>
        <div className={s.footLogo}><span className={s.footLogoAccent}>{nameFirst}</span>{nameRest}</div>
        <div>{dealer.publicDomain ?? ""}</div>
      </footer>
    </div>
  );
}
