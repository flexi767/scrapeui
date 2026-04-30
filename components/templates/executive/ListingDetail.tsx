import Link from "next/link";
import { getListingThumbSrc } from "@/lib/listing-thumb";
import type { ListingDetailProps } from "../types";
import s from "./ListingDetail.module.css";

function fmt(n: number | null, suffix = "") { return n != null ? n.toLocaleString("bg-BG") + suffix : "—"; }

export function ListingDetail({ dealer, listing }: ListingDetailProps) {
  const base = `/d/${dealer.slug}`;
  const initial = dealer.name.charAt(0);
  const thumb = getListingThumbSrc({ mobile_id: listing.mobileId, thumb_keys: listing.thumbKeys, full_keys: listing.fullKeys, image_meta: listing.imageMeta, images_downloaded: listing.imagesDownloaded, thumb_saved: listing.thumbSaved });

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div className={s.logoWrap}>
          <div className={s.logoMark}>{initial}</div>
          <div className={s.logoText}><span className={s.logoAccent}>{initial}</span>{dealer.name.slice(1).toUpperCase()}</div>
        </div>
        <Link href={base} className={s.back}>← Back</Link>
      </header>
      <div className={s.main}>
        <div>
          {thumb
            ? <div className={s.imageWrap}><img src={thumb} alt={`${listing.make} ${listing.model}`} /></div>
            : <div className={s.imagePlaceholder}>🚗</div>}
          {listing.description && <div className={s.description}>{listing.description}</div>}
        </div>
        <div className={s.panel}>
          <div className={s.carMake}>{listing.make}</div>
          <div className={s.carTitle}>{listing.make} {listing.model}</div>
          <div className={s.carSub}>{listing.regYear} · {listing.fuel ?? ""}</div>
          <div className={s.price}>{fmt(listing.currentPrice)} лв</div>
          <div className={s.specs}>
            {listing.mileage != null && <div className={s.specItem}><div className={s.specLbl}>Mileage</div><div className={s.specVal}>{fmt(listing.mileage)} km</div></div>}
            {listing.fuel && <div className={s.specItem}><div className={s.specLbl}>Fuel</div><div className={s.specVal}>{listing.fuel}</div></div>}
            {listing.transmission && <div className={s.specItem}><div className={s.specLbl}>Gearbox</div><div className={s.specVal}>{listing.transmission}</div></div>}
            {listing.power != null && <div className={s.specItem}><div className={s.specLbl}>Power</div><div className={s.specVal}>{listing.power} hp</div></div>}
            {listing.color && <div className={s.specItem}><div className={s.specLbl}>Color</div><div className={s.specVal}>{listing.color}</div></div>}
          </div>
          <button className={s.cta}>Enquire Now</button>
        </div>
      </div>
      <footer className={s.footer}><span className={s.footAccent}>{initial}</span>{dealer.name.slice(1).toUpperCase()}</footer>
    </div>
  );
}
