export function formatPrice(price: number | null | undefined): string {
  if (price == null) return '—';
  return '€' + price.toLocaleString('en-US');
}

export function formatMileage(mileage: number | null | undefined): string {
  if (mileage == null) return '—';
  return mileage.toLocaleString('en-US') + ' km';
}

// Input: "2026-03-10 08:36" → Output: "10.03.2026 08:36"
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})/);
  if (!m) return dateStr;
  return `${m[3]}.${m[2]}.${m[1].slice(2)} ${m[4]}`;
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
