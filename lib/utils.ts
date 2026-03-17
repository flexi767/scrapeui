import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number | null | undefined): string {
  if (price == null) return '—';
  return '€' + price.toLocaleString('en-US');
}

export function formatMileage(mileage: number | null | undefined): string {
  if (mileage == null) return '—';
  return mileage.toLocaleString('en-US') + ' km';
}

// Standard datetime display: dd.mm.yy hh:mm
// Supports both "YYYY-MM-DD HH:MM" and ISO timestamps like "2026-03-16T10:21:00.000Z"
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';

  const plain = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})/);
  if (plain) return `${plain[3]}.${plain[2]}.${plain[1].slice(2)} ${plain[4]}`;

  const d = new Date(dateStr);
  if (!Number.isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(2);
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}.${mm}.${yy} ${hh}:${min}`;
  }

  return dateStr;
}

export interface ImageMeta {
  cdn: string;
  shard: string;
}

export function getCdnImageUrl(
  mobileId: string,
  key: string,
  imageMeta: ImageMeta,
  size: 'full' | 'thumb' = 'full',
): string {
  const last3 = mobileId.slice(-3);
  const dir = size === 'full' ? 'big1/' : '';
  return `https://${imageMeta.cdn}/mobile/photosorg/${last3}/${imageMeta.shard}/${dir}${mobileId}_${key}.webp`;
}

export function getLocalImageUrl(
  mobileId: string,
  type: 'full' | 'thumbs',
  index: number,
): string {
  const filename = String(index + 1).padStart(2, '0') + '.webp';
  return `/api/images/${mobileId}/${type}/${filename}`;
}

export interface ListingImage {
  full: string;
  thumb: string;
}

export function buildImageList(
  mobileId: string,
  fullKeys: string[],
  thumbKeys: string[],
  imageMeta: ImageMeta | null,
  imagesDownloaded: boolean,
): ListingImage[] {
  if (!fullKeys.length) return [];

  return fullKeys.map((key, i) => {
    if (imagesDownloaded) {
      return {
        full: getLocalImageUrl(mobileId, 'full', i),
        thumb: getLocalImageUrl(mobileId, 'thumbs', i),
      };
    }
    if (!imageMeta) return { full: '', thumb: '' };
    return {
      full: getCdnImageUrl(mobileId, key, imageMeta, 'full'),
      thumb: getCdnImageUrl(mobileId, thumbKeys[i] ?? key, imageMeta, 'thumb'),
    };
  });
}

export function parseJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
