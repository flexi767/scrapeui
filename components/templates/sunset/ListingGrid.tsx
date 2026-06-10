"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getPublicThumbSrc } from "../utils";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import type { ListingGridProps } from "../types";
import { fmtPrice, fmtMileage } from "../utils";
import { MakeSelect, FuelSelect, SortSelect, Pagination } from "../FilterBar";
import { Shell } from "./Shell";
import s from "./ListingGrid.module.css";

export function ListingGrid({ dealer, listings, total, page, limit, makes, filters, nextCursor }: ListingGridProps) {
  const t = useTranslations("ui");
  const base = `/d/${dealer.slug}`;
  const totalPages = Math.ceil(total / limit);

  return (
    <Shell dealer={dealer} current="cars">
      <div className={s.hero}>
        <div className={s.heroBg} style={{ backgroundImage: "url('https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1400&h=500&fit=crop')" }} />
        <div className={s.heroOverlay} />
        <div className={s.heroContent}>
          <div className={s.heroBadge}>{total} {t("vehicles_available")}</div>
          <h1 className={s.heroTitle}>{dealer.name}</h1>
        </div>
      </div>

      <div className={s.body}>
        <div className={s.searchStrip}>
          <MakeSelect base={base} filters={filters} makes={makes} className={s.searchSelect} />
          <FuelSelect base={base} filters={filters} className={s.searchSelect} allLabel={t("any_fuel")} />
          <SortSelect base={base} filters={filters} className={s.searchSelect} />
        </div>

        <div className={s.sectionHead}>
          <div className={s.sectionTitle}>{t("available_vehicles")}</div>
          <div className={s.sectionCount}>{total} {t("vehicles")}</div>
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
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <Pagination
          page={page} totalPages={totalPages} base={base} filters={filters}
          nextCursor={nextCursor} cursorActive={Boolean(filters.cursor)}
          wrapperClassName={s.pagination} btnClassName={s.pageBtn} btnActiveClassName={s.pageBtnActive}
        />

        <div className={s.trustBar}>
          <div className={s.trustItem}>
            <div className={s.trustIcon}>🚗</div>
            <div className={s.trustVal}>{total}+</div>
            <div className={s.trustLbl}>{t("vehicles")}</div>
          </div>
          <div className={s.trustItem}>
            <div className={s.trustIcon}>✅</div>
            <div className={s.trustVal}>{t("inspected")}</div>
            <div className={s.trustLbl}>{t("all_cars_checked")}</div>
          </div>
          <div className={s.trustItem}>
            <div className={s.trustIcon}>📞</div>
            <div className={s.trustVal}>{t("support")}</div>
            <div className={s.trustLbl}>{t("here_to_help")}</div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
