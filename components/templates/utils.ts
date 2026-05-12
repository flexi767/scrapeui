import { getListingThumbSrc } from "@/lib/listing-thumb";
import type { PublicListingFilters } from "./types";

export function getPublicThumbSrc(l: { mobileId: string; thumbKeys: string | null; fullKeys: string | null; imageMeta: string | null; imagesDownloaded: number | null; thumbSaved: number | null }) {
  return getListingThumbSrc({ mobile_id: l.mobileId, thumb_keys: l.thumbKeys, full_keys: l.fullKeys, image_meta: l.imageMeta, images_downloaded: l.imagesDownloaded, thumb_saved: l.thumbSaved });
}

export function fmtPrice(p: number | null): string {
  return p ? p.toLocaleString("bg-BG") + " лв" : "—";
}

export function fmtMileage(m: number | null): string {
  return m ? m.toLocaleString("bg-BG") + " km" : "—";
}

export function fmt(n: number | null, suffix = ""): string {
  return n != null ? n.toLocaleString("bg-BG") + suffix : "—";
}

export function filterHref(
  base: string,
  f: PublicListingFilters,
  u: Record<string, string | number | undefined>,
): string {
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
