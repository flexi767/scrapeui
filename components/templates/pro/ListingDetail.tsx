import Link from "next/link";
import { getListingThumbSrc } from "@/lib/listing-thumb";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import type { ListingDetailProps } from "../types";
import { fmt } from "../utils";
import s from "./ListingDetail.module.css";

export function ListingDetail({ dealer, listing }: ListingDetailProps) {
  const base = `/d/${dealer.slug}`;
  const thumb = getListingThumbSrc({ mobile_id: listing.mobileId, thumb_keys: listing.thumbKeys, full_keys: listing.fullKeys, image_meta: listing.imageMeta, images_downloaded: listing.imagesDownloaded, thumb_saved: listing.thumbSaved });

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <span className={s.logoBadge}>PRO</span>
          <span className={s.logoName}>{dealer.name}</span>
        </div>
        <Link href={base} className={s.back}>← Back to listings</Link>
      </header>
      <div className={s.main}>
        <div>
          {thumb
            ? <div className={s.imageWrap}><ImageWithFallback src={thumb} alt="Vehicle photo" fallbackLabel="No image" /></div>
            : <div className={s.imagePlaceholder}>🚗</div>}
          {listing.description && <div className={s.description}>{listing.description}</div>}
        </div>
        <div className={s.panel}>
          <div className={s.carMake}>{listing.make}</div>
          <div className={s.carTitle}>{listing.make} {listing.model}</div>
          <div className={s.carSub}>{listing.regYear} · {listing.bodyType ?? ""}</div>
          <div className={s.price}>{fmt(listing.currentPrice)} лв</div>
          <div className={s.specs}>
            {listing.fuel && <div className={s.specItem}><div className={s.specLbl}>Fuel</div><div className={s.specVal}>{listing.fuel}</div></div>}
            {listing.mileage != null && <div className={s.specItem}><div className={s.specLbl}>Mileage</div><div className={s.specVal}>{fmt(listing.mileage)} km</div></div>}
            {listing.transmission && <div className={s.specItem}><div className={s.specLbl}>Gearbox</div><div className={s.specVal}>{listing.transmission}</div></div>}
            {listing.power != null && <div className={s.specItem}><div className={s.specLbl}>Power</div><div className={s.specVal}>{listing.power} hp</div></div>}
            {listing.color && <div className={s.specItem}><div className={s.specLbl}>Color</div><div className={s.specVal}>{listing.color}</div></div>}
            {listing.regYear && <div className={s.specItem}><div className={s.specLbl}>Year</div><div className={s.specVal}>{listing.regYear}</div></div>}
          </div>
          <a href={dealer.mobileUrl ?? '#'} target="_blank" rel="noopener noreferrer" className={s.cta}>Enquire Now</a>
        </div>
      </div>
      <footer className={s.footer}>
        <span className={s.footLogo}>{dealer.name}</span>
        <span>{dealer.publicDomain ?? ""}</span>
      </footer>
    </div>
  );
}
