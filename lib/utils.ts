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

export function formatCount(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString('en-US');
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

export function getThumbProxyUrl(
  mobileId: string,
  fallbackUrl: string | null | undefined,
): string {
  const params = new URLSearchParams();
  if (fallbackUrl) params.set('fallback', fallbackUrl);
  return `/api/thumbs/${encodeURIComponent(mobileId)}${params.toString() ? `?${params.toString()}` : ''}`;
}

export interface ListingImage {
  full: string;
  thumb: string;
}

export function getPreferredListingThumbUrl(
  mobileId: string | null | undefined,
  remoteThumbUrl: string | null | undefined,
  thumbSaved: number | null | undefined,
): string | null {
  if (!mobileId) return remoteThumbUrl ?? null;
  if (thumbSaved === 1 || remoteThumbUrl) {
    return getThumbProxyUrl(mobileId, remoteThumbUrl ?? null);
  }
  return null;
}

function normalizeImageKey(key: string): string {
  return key.trim();
}

function keysMatchBySet(fullKeys: string[], thumbKeys: string[]): boolean {
  if (fullKeys.length === 0 || thumbKeys.length === 0) return false;
  if (fullKeys.length !== thumbKeys.length) return false;
  if (fullKeys.some((key) => key.startsWith('http')) || thumbKeys.some((key) => key.startsWith('http'))) {
    return false;
  }

  const fullCounts = new Map<string, number>();
  for (const key of fullKeys) {
    const normalized = normalizeImageKey(key);
    fullCounts.set(normalized, (fullCounts.get(normalized) ?? 0) + 1);
  }

  for (const key of thumbKeys) {
    const normalized = normalizeImageKey(key);
    const count = fullCounts.get(normalized) ?? 0;
    if (count === 0) return false;
    if (count === 1) fullCounts.delete(normalized);
    else fullCounts.set(normalized, count - 1);
  }

  return fullCounts.size === 0;
}

export function buildImageList(
  mobileId: string,
  fullKeys: string[],
  thumbKeys: string[],
  imageMeta: ImageMeta | null,
  imagesDownloaded: boolean,
): ListingImage[] {
  if (!fullKeys.length) return [];

  const useThumbOrder = keysMatchBySet(fullKeys, thumbKeys);
  const orderedKeys = useThumbOrder ? thumbKeys : fullKeys;

  return orderedKeys.map((key, i) => {
    // Cars.bg listings store full URLs directly as keys
    if (key.startsWith('http')) {
      const remoteThumb = thumbKeys[i]?.startsWith('http') ? thumbKeys[i] : key;
      return { full: key, thumb: remoteThumb };
    }
    if (imagesDownloaded) {
      return {
        full: getLocalImageUrl(mobileId, 'full', i),
        thumb: getLocalImageUrl(mobileId, 'thumbs', i),
      };
    }
    if (!imageMeta) return { full: '', thumb: '' };
    const thumbKey = useThumbOrder ? key : (thumbKeys[i] ?? key);
    const fullKey = useThumbOrder ? key : key;
    return {
      full: getCdnImageUrl(mobileId, fullKey, imageMeta, 'full'),
      thumb: getCdnImageUrl(mobileId, thumbKey, imageMeta, 'thumb'),
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

export function normalizeVin(value: string | null | undefined): string {
  if (!value) return '';
  const vin = value.trim().toUpperCase();
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin) ? vin : '';
}

export async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({}));
}

export async function parseApiResponse<T>(response: Response, fallbackError: string): Promise<T> {
  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error || fallbackError);
  }
  return payload as T;
}

export async function apiRequest<T>(
  url: string,
  fallbackError: string,
  options: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...init } = options;
  const requestHeaders = new Headers(headers);
  if (json !== undefined) {
    requestHeaders.set('Content-Type', 'application/json');
  }
  const response = await fetch(url, {
    ...init,
    headers: requestHeaders,
    body: json === undefined ? init.body : JSON.stringify(json),
  });
  return parseApiResponse<T>(response, fallbackError);
}

export function errorMessage(error: unknown, fallback?: string): string {
  return error instanceof Error ? error.message : fallback ?? String(error);
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object'
    && error !== null
    && 'name' in error
    && error.name === 'AbortError'
  );
}
