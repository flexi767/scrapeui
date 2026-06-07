import Link from "next/link";
import { getPublicThumbSrc } from "../utils";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import type { ListingDetailProps } from "../types";
import { fmt } from "../utils";
import { Shell } from "./Shell";
import s from "./ListingDetail.module.css";

export function ListingDetail({ dealer, listing }: ListingDetailProps) {
  const base = `/d/${dealer.slug}`;
  const thumb = getPublicThumbSrc(listing);

  return (
    <Shell dealer={dealer}>
      <div className={s.main}>
        <div>
          <Link href={base} className={s.back}>← Back</Link>
          {thumb
            ? <div className={s.imageWrap}><ImageWithFallback src={thumb} alt="Vehicle photo" fallbackLabel="No image" /></div>
            : <div className={s.imagePlaceholder}>🚗</div>}
          {listing.description && <div className={s.description}>{listing.description}</div>}
        </div>
        <div className={s.panel}>
          <div className={s.carMake}>{listing.make}</div>
          <div className={s.carTitle}>{listing.make} {listing.model}</div>
          <div className={s.carSub}>{listing.regYear} · {listing.fuel ?? ""}</div>
          <div className={s.price}>{fmt(listing.currentPrice)} €</div>
          <div className={s.specs}>
            {listing.mileage != null && <div className={s.specItem}><div className={s.specLbl}>Mileage</div><div className={s.specVal}>{fmt(listing.mileage)} km</div></div>}
            {listing.fuel && <div className={s.specItem}><div className={s.specLbl}>Fuel</div><div className={s.specVal}>{listing.fuel}</div></div>}
            {listing.transmission && <div className={s.specItem}><div className={s.specLbl}>Gearbox</div><div className={s.specVal}>{listing.transmission}</div></div>}
            {listing.power != null && <div className={s.specItem}><div className={s.specLbl}>Power</div><div className={s.specVal}>{listing.power} hp</div></div>}
            {listing.color && <div className={s.specItem}><div className={s.specLbl}>Color</div><div className={s.specVal}>{listing.color}</div></div>}
          </div>
          <a href={dealer.mobileUrl ?? `${base}/contact`} target={dealer.mobileUrl ? "_blank" : undefined} rel="noopener noreferrer" className={s.cta}>Enquire Now</a>
        </div>
      </div>
    </Shell>
  );
}
