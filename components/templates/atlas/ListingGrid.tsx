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

export function ListingGrid({ dealer, listings, total, page, limit, makes, filters }: ListingGridProps) {
  const t = useTranslations("ui");
  const base = `/d/${dealer.slug}`;
  const totalPages = Math.ceil(total / limit);

  return (
    <Shell dealer={dealer} current="cars">
      <div className={s.filterBar}>
        <MakeSelect base={base} filters={filters} makes={makes} />
        <FuelSelect base={base} filters={filters} allLabel={t("any_fuel")} />
        <SortSelect base={base} filters={filters} />
        <div className={s.filterCount}>{total} {t("vehicles")}</div>
      </div>

      <div className={s.grid}>
        {listings.map((l, idx) => {
          const thumb = getPublicThumbSrc(l);
          const isFeatured = idx === 0;
          return (
            <Link key={l.mobileId ?? idx} href={`${base}/${l.mobileId}`} className={`${s.card} ${isFeatured ? s.cardFeatured : ""}`}>
              <div className={s.cardImg}>
                {thumb ? <ImageWithFallback src={thumb} alt={t("vehicle_photo")} fallbackLabel={t("no_image")} /> : <div className={s.cardImgPlaceholder}>🚗</div>}
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
                <span className={s.viewLink}>{t("view")} →</span>
              </div>
            </Link>
          );
        })}
      </div>

      <Pagination
        page={page} totalPages={totalPages} base={base} filters={filters}
        wrapperClassName={s.pagination} btnClassName={s.pageBtn} btnActiveClassName={s.pageBtnActive}
      />
    </Shell>
  );
}
