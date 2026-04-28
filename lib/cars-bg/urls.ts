import { CARS_BG_BASE_URL } from "@/lib/cars-bg/auth";

const CARS_BG_OBJECT_TYPE_CAR = 1;

export function buildCarsBgOfferUrl(offerId: string, { myoffer = true, clear = true } = {}): string {
  const params = new URLSearchParams();
  if (myoffer) params.set("myoffer", "1");
  if (clear) params.set("clear", "1");
  const qs = params.toString();
  return `${CARS_BG_BASE_URL}/offer/${offerId}${qs ? `?${qs}` : ""}`;
}

export function buildCarsBgEditUrl(offerId: string, objectTypeId = CARS_BG_OBJECT_TYPE_CAR): string {
  return `${CARS_BG_BASE_URL}/editcar.php?objectId=${offerId}&object_typeId=${objectTypeId}`;
}

export function buildCarsBgEditPhotosUrl(offerId: string, objectTypeId = CARS_BG_OBJECT_TYPE_CAR): string {
  return `${CARS_BG_BASE_URL}/editphoto.php?objectId=${offerId}&object_typeId=${objectTypeId}`;
}

export function extractOfferId(input = ""): string | null {
  const value = String(input || "");
  const direct = value.match(/^[a-z0-9]{12,}$/i);
  if (direct) return direct[0];
  const offerMatch = value.match(/\/offer\/([^/?#]+)/i);
  if (offerMatch?.[1]) return offerMatch[1];
  const objectMatch = value.match(/[?&]objectId=([^&#]+)/i);
  if (objectMatch?.[1]) return objectMatch[1];
  return null;
}

export function extractMobileIdFromUrl(url = ""): string | null {
  const match = url.match(/obiava-(\d+)/);
  return match ? match[1] : null;
}
