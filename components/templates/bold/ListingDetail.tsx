import { getTranslations } from "next-intl/server";
import { getPublicThumbSrc } from "../utils";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import type { ListingDetailProps } from "../types";
import { fmt } from "../utils";
import { Shell } from "./Shell";
import s from "./ListingDetail.module.css";

export async function ListingDetail({ dealer, listing }: ListingDetailProps) {
  const t = await getTranslations("ui");
  const thumb = getPublicThumbSrc(listing);

  return (
    <Shell dealer={dealer} current="cars">
      <div className={s.main}>
        <div>
          {thumb
            ? <div className={s.imageWrap}><ImageWithFallback src={thumb} alt={t("vehicle_photo")} fallbackLabel={t("no_image")} /></div>
            : <div className={s.imagePlaceholder}>🚗</div>}
          {listing.description && <div className={s.description}>{listing.description}</div>}
        </div>
        <div className={s.panel}>
          <div className={s.carMake}>{listing.make}</div>
          <div className={s.carTitle}>{listing.make} {listing.model}</div>
          <div className={s.carSub}>{listing.regYear} · {listing.bodyType ?? ""}</div>
          <div className={s.price}>{fmt(listing.currentPrice)} €</div>
          <div className={s.specs}>
            {listing.fuel && <div className={s.specItem}><div className={s.specLbl}>{t("fuel")}</div><div className={s.specVal}>{listing.fuel}</div></div>}
            {listing.mileage != null && <div className={s.specItem}><div className={s.specLbl}>{t("mileage")}</div><div className={s.specVal}>{fmt(listing.mileage)} km</div></div>}
            {listing.transmission && <div className={s.specItem}><div className={s.specLbl}>{t("transmission")}</div><div className={s.specVal}>{listing.transmission}</div></div>}
            {listing.power != null && <div className={s.specItem}><div className={s.specLbl}>{t("power")}</div><div className={s.specVal}>{listing.power} {t("hp")}</div></div>}
            {listing.color && <div className={s.specItem}><div className={s.specLbl}>{t("color")}</div><div className={s.specVal}>{listing.color}</div></div>}
            {listing.regYear && <div className={s.specItem}><div className={s.specLbl}>{t("year")}</div><div className={s.specVal}>{listing.regYear}</div></div>}
          </div>
          <a href={dealer.mobileUrl ?? `/d/${dealer.slug}/contact`} target={dealer.mobileUrl ? "_blank" : undefined} rel="noopener noreferrer" className={s.cta}>{t("contact_dealer")}</a>
        </div>
      </div>
    </Shell>
  );
}
