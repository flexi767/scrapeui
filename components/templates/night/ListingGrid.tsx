"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getPublicThumbSrc } from "../utils";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import type { ListingGridProps } from "../types";
import { fmtPrice, fmtMileage } from "../utils";
import { MakeSelect, FuelSelect, SortSelect, PriceMaxInput, Pagination } from "../FilterBar";
import { Shell } from "./Shell";
import s from "./ListingGrid.module.css";

export function ListingGrid({ dealer, listings, total, page, limit, makes, filters }: ListingGridProps) {
  const t = useTranslations("ui");
  const base = `/d/${dealer.slug}`;
  const totalPages = Math.ceil(total / limit);

  return (
    <Shell dealer={dealer} current="cars">
      <div className={s.ticker}>
        <span><strong>{total}</strong> {t("vehicles_available")}</span>
        <span>{t("updated_today")}</span>
        <span>{dealer.name}</span>
      </div>

      <div className={s.heroStrip}>
        <h1 className={s.heroH1}>{dealer.name}</h1>
        <p className={s.heroSub}>{t("browse_inventory")}</p>
      </div>

      <div className={s.main}>
        <aside className={s.sidebar}>
          <div className={s.sidebarTitle}>{t("filters")}</div>
          <div className={s.filterGroup}>
            <label className={s.filterLabel}>{t("make")}</label>
            <MakeSelect base={base} filters={filters} makes={makes} className={s.filterSelect} allLabel={t("all_makes")} />
          </div>
          <div className={s.filterGroup}>
            <label className={s.filterLabel}>{t("fuel")}</label>
            <FuelSelect base={base} filters={filters} className={s.filterSelect} allLabel={t("any_fuel")} />
          </div>
          <div className={s.filterGroup}>
            <label className={s.filterLabel}>{t("max_price")}</label>
            <PriceMaxInput base={base} filters={filters} className={s.filterInput} />
          </div>
        </aside>

        <div>
          <div className={s.listTop}>
            <div className={s.listCount}><strong>{total}</strong> {t("vehicles")}</div>
            <SortSelect base={base} filters={filters} className={s.sortSelect} includeMileage />
          </div>

          <div className={s.grid}>
            {listings.map((l, i) => {
              const thumb = getPublicThumbSrc(l);
              return (
                <Link key={l.mobileId ?? i} href={`${base}/${l.mobileId}`} className={s.card}>
                  <div className={s.cardImg}>
                    {thumb ? <ImageWithFallback src={thumb} alt={t("vehicle_photo")} fallbackLabel={t("no_image")} /> : <div className={s.cardImgPlaceholder}>🚗</div>}
                    {l.isNew === 1 && <span className={s.cardTag}>{t("new")}</span>}
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
                      <span className={s.viewBtn}>{t("view")}</span>
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
    </Shell>
  );
}
