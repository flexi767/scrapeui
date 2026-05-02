import { getVatFromMobileBgLabel } from '@/lib/vat';

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function normalizeVin(value: string | null | undefined): string {
  if (!value) return '';
  const vin = value.trim().toUpperCase();
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin) ? vin : '';
}

export function inferBatteryRangeKm(fuel: string | null, description: string | null): string {
  if (!fuel?.toLowerCase().includes('електр')) return '';
  const match = (description || '').match(
    /(?:wltp|зареждане|пробег)[^\d]{0,80}(\d{2,4})(?:\s*[-–]\s*(\d{2,4}))?\s*(?:км|km)/iu,
  );
  return match ? (match[2] || match[1]) : '';
}

export function inferBatteryCapacityKwh(
  fuel: string | null,
  make: string | null,
  model: string | null,
  title: string | null,
  description: string | null,
): string {
  if (!fuel?.toLowerCase().includes('електр')) return '';
  const text = `${make ?? ''} ${model ?? ''} ${title ?? ''} ${description ?? ''}`;
  const match = text.match(/(\d{2,3})\s*(?:kwh|квтч|квт\.ч|квт ч)/iu);
  if (match) return match[1];
  if ((make || '').toLowerCase() === 'tesla' && /model\s*y/i.test(model || '')) {
    return '75';
  }
  return '';
}

export interface BackupRow {
  dealer_id: number;
  make: string | null;
  model: string | null;
  title: string | null;
  fuel: string | null;
  power: number | null;
  transmission: string | null;
  category: string | null;
  mileage: number | null;
  color: string | null;
  description: string | null;
  price_amount: number | null;
  price_currency: string | null;
  vat_included: string | number | null;
  year: number | null;
  engine: string | null;
  phones_json: string | null;
  extras_json: string | null;
  tech_data_json: string | null;
}

export interface FullFormBody {
  dealerId: string;
  pubtype: string;
  make: string;
  model: string;
  title: string;
  condition?: string;
  body_type?: string;
  bodyType?: string;
  fuel: string;
  transmission: string;
  productionMonth?: string;
  productionYear?: string;
  mileage: string;
  power: string;
  engineCc: string;
  euronorm?: string;
  batteryRange?: string;
  batteryCapacity?: string;
  color: string;
  region: string;
  city: string;
  price: string;
  priceOnRequest?: boolean;
  vat: string;
  currency?: string;
  vin?: string;
  description: string;
  phone?: string;
  email?: string;
  website?: string;
  extras: Record<string, string[]>;
}

export function parseString(value: unknown, label: string, required = false): string | null {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`);
  }
  const trimmed = value.trim();
  if (required && !trimmed) {
    throw new Error(`${label} is required`);
  }
  return trimmed || null;
}

export function parseNonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

export function parseBinaryInteger(value: unknown, label: string): number {
  if (value !== 0 && value !== 1) {
    throw new Error(`${label} must be 0 or 1`);
  }
  return value;
}

export function parseAdStatus(value: unknown): string {
  if (typeof value !== 'string' || !['none', 'TOP', 'VIP'].includes(value)) {
    throw new Error('Invalid ad_status value');
  }
  return value;
}

export function isFullFormBody(
  value: Record<string, unknown>,
): value is Record<string, unknown> & FullFormBody {
  return typeof value.dealerId === 'string' && typeof value.make === 'string';
}

export function buildTechData(body: FullFormBody): string | null {
  const productionYear = body.productionYear ?? '';
  const techDataPayload: Record<string, string> = {};
  if (body.pubtype) techDataPayload.pubtype = body.pubtype;
  if (body.region) techDataPayload.region = body.region;
  if (body.city) techDataPayload.city = body.city;
  if (body.condition) techDataPayload.f25 = body.condition;
  if (body.euronorm) techDataPayload.f29 = body.euronorm.replace(/^Евро\s+/, '');
  if (body.currency) techDataPayload.f13 = body.currency;
  if (body.productionMonth) techDataPayload.f14 = body.productionMonth;
  if (productionYear) techDataPayload.f15 = productionYear;
  if (body.phone) techDataPayload.f22 = body.phone;
  if (body.email) techDataPayload.f23 = body.email;
  if (body.website) techDataPayload.f24 = body.website;
  if (body.vin) techDataPayload.f32 = body.vin;
  if (body.batteryRange) techDataPayload.f33 = body.batteryRange;
  if (body.batteryCapacity) techDataPayload.f34 = body.batteryCapacity;
  if (body.priceOnRequest) techDataPayload.priceneg = '99999999';
  return Object.keys(techDataPayload).length > 0
    ? JSON.stringify(techDataPayload)
    : null;
}

export function buildExtrasJson(body: FullFormBody): string | null {
  return body.extras && Object.keys(body.extras).length > 0
    ? JSON.stringify(body.extras)
    : null;
}

export function getFullFormVat(body: FullFormBody) {
  return getVatFromMobileBgLabel(body.vat);
}
