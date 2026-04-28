export function extractThumbFromListing(listing: { full_keys: string | null }): string | null {
  if (!listing.full_keys) return null;
  try {
    const images = JSON.parse(listing.full_keys) as unknown;
    if (!Array.isArray(images)) return null;
    const first = images.find((value) => typeof value === 'string' && value.trim());
    return typeof first === 'string' ? first : null;
  } catch {
    return null;
  }
}

export function normalizeModelCompare(value: string | null | undefined): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9а-я]+/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function modelsLookEquivalent(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeModelCompare(a);
  const right = normalizeModelCompare(b);
  if (!left || !right) return false;
  if (left === right) return true;
  return left.includes(right) || right.includes(left);
}

/** Extract cars.bg offer hex ID from URL like /offer/68bfd7021598f924570a0a52 */
export function extractCarsId(url: string): string | null {
  const m = url?.match(/\/offer\/([a-f0-9]{10,})/i);
  return m ? m[1] : null;
}

/** Map Bulgarian fuel strings from cars.bg to our normalized values */
const CARSBG_FUEL_MAP: Record<string, string> = {
  'бензин': 'Бензин',
  'дизел': 'Дизел',
  'хибрид': 'Хибрид',
  'електрически': 'Електрически',
  'газ/бензин': 'Газ/Бензин',
  'газ': 'Газ/Бензин',
};

/** Map Bulgarian transmission strings from cars.bg */
const CARSBG_TRANS_MAP: Record<string, string> = {
  'автоматични скорости': 'Автоматична',
  'автоматична': 'Автоматична',
  'ръчни скорости': 'Ръчна',
  'ръчна': 'Ръчна',
};

/** Map Bulgarian body types from cars.bg */
const CARSBG_BODY_MAP: Record<string, string> = {
  'седан': 'Седан',
  'хечбек': 'Хечбек',
  'комби': 'Комби',
  'suv': 'Джип/SUV',
  'джип': 'Джип/SUV',
  'купе': 'Купе',
  'кабрио': 'Кабрио',
  'ван': 'Ван',
  'миниван': 'Миниван',
};

export function normCarsBgFuel(raw: string | null): string | null {
  if (!raw) return null;
  return CARSBG_FUEL_MAP[raw.toLowerCase().trim()] ?? raw;
}

export function normCarsBgTrans(raw: string | null): string | null {
  if (!raw) return null;
  return CARSBG_TRANS_MAP[raw.toLowerCase().trim()] ?? raw;
}

export function normCarsBgBody(raw: string | null): string | null {
  if (!raw) return null;
  return CARSBG_BODY_MAP[raw.toLowerCase().trim()] ?? raw;
}

/**
 * Parse the specs string from either the list card <p> or the detail page.
 * Format: "2019, Дизел, 219000 км." or
 *         "Януари 2019, Седан, ..., Дизел, 219 000км, Автоматични скорости, 286к.с., 4/5 врати, Тъмно син металик"
 */
export function parseSpecsString(specs: string) {
  // Year: 4-digit number (with optional Bulgarian month before it)
  const yearMatch = specs.match(/(\d{4})/);
  const year = yearMatch ? yearMatch[1] : null;

  // Mileage: digits (possibly with spaces) followed by км
  const mileageMatch = specs.match(/([\d\s]+)\s*км/);
  const mileage = mileageMatch ? parseInt(mileageMatch[1].replace(/\s/g, '')) || null : null;

  // Power: digits followed by к.с.
  const powerMatch = specs.match(/(\d+)\s*к\.с\./);
  const power = powerMatch ? parseInt(powerMatch[1]) : null;

  // Fuel
  const fuelMatch = specs.match(/(Бензин|Дизел|Хибрид|Електрически|Газ\/Бензин)/i);
  const fuel = fuelMatch ? fuelMatch[1] : null;

  // Transmission
  const transMatch = specs.match(/(Автоматични скорости|Ръчни скорости)/i);
  const transmission = transMatch ? transMatch[1] : null;

  // Body type: comes right after the year as second comma-separated token
  const bodyMatch = specs.match(/(Седан|Хечбек|Комби|SUV|Джип|Купе|Кабрио|Ван|Миниван)/i);
  const bodyType = bodyMatch ? bodyMatch[1] : null;

  // Color: after "X/Y врати, " pattern, but stop before the next line/section
  const colorMatch = specs.match(/\d\/\d\s+врати,\s*([^\n\r]+)/);
  const color = colorMatch ? colorMatch[1].trim() : null;

  return { year, mileage, power, fuel, transmission, bodyType, color };
}

export function parseCarsBgPriceToEur(value: string | null | undefined): number | null {
  if (!value) return null;

  const normalized = value.replace(/\u00a0/g, ' ').trim();
  const firstLineWithDigits = normalized
    .split('\n')
    .map((part) => part.trim())
    .find((part) => /\d/.test(part));
  const raw = firstLineWithDigits?.match(/[\d][\d ,.]*/)?.[0]
    ?? normalized.match(/[\d][\d ,.]*/)?.[0]
    ?? null;

  if (!raw) return null;

  const integerPart = raw.replace(/[^\d]/g, '');

  if (!integerPart) return null;

  const parsed = Number.parseInt(integerPart, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseCarsBgCreatedDateFromImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = String(value).match(/\/(20\d{2}-\d{2}-\d{2})_\d+\//);
  return match ? match[1] : null;
}

export function parseCarsBgEditedDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = String(value).match(/\b(\d{2})\.(\d{2})\.(\d{2}|\d{4})\b/);
  if (!match) return null;
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[2]}-${match[1]}`;
}

export function normalizeCompareText(value: string | null | undefined): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9а-я]+/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleOverlapScore(a: string | null | undefined, b: string | null | undefined): number {
  const aTokens = new Set(normalizeCompareText(a).split(' ').filter((token) => token.length > 2));
  const bTokens = new Set(normalizeCompareText(b).split(' ').filter((token) => token.length > 2));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap++;
  }
  return overlap;
}

export function normalizeCarsBgImages(
  urls: Array<string | null | undefined>,
  maxImages = 15,
): string[] {
  const preferred = new Map<string, string>();

  for (const raw of urls) {
    const value = String(raw || '').trim();
    if (!value || !value.includes('g1-bg.cars.bg/') || value.includes('/users_logos/')) continue;

    const normalized = value.replace(/\?.*$/, '');
    const baseKey = normalized.replace(/([ob])(\.[a-z0-9]+)$/i, '$2');
    const existing = preferred.get(baseKey);

    if (!existing) {
      preferred.set(baseKey, normalized);
      continue;
    }

    const existingIsOriginal = /o\.[a-z0-9]+$/i.test(existing);
    const currentIsOriginal = /o\.[a-z0-9]+$/i.test(normalized);
    if (!existingIsOriginal && currentIsOriginal) {
      preferred.set(baseKey, normalized);
    }
  }

  return [...preferred.values()].slice(0, maxImages);
}
