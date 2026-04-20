import { NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { getMobileBgVatLabel } from '@/lib/vat';

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeVin(value: string | null | undefined): string {
  if (!value) return '';
  const vin = value.trim().toUpperCase();
  // Keep VIN strict to avoid placeholder values like "bp49".
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin) ? vin : '';
}

interface BackupRow {
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ backupId: string }> },
) {
  const { backupId: backupIdParam } = await params;
  const backupId = Number(backupIdParam);
  if (!Number.isInteger(backupId) || backupId <= 0) {
    return NextResponse.json({ error: 'Invalid backup ID' }, { status: 400 });
  }

  const row = raw
    .prepare(
      `SELECT dealer_id, make, model, title, fuel, power, transmission, category,
              mileage, color, description, price_amount, price_currency, vat_included,
              year, engine, phones_json, extras_json, tech_data_json
       FROM mobilebg_backups WHERE id = ?`,
    )
    .get(backupId) as BackupRow | undefined;

  if (!row) {
    return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
  }

  const techData = parseJson<Record<string, string>>(row.tech_data_json, {});
  const extrasRaw = parseJson<unknown>(row.extras_json, null);
  const phones = parseJson<string[]>(row.phones_json, []);

  // Normalise extras: backup format is Record<string, {label,alias}[]>
  const extras: Record<string, string[]> = {};
  if (extrasRaw && typeof extrasRaw === 'object' && !Array.isArray(extrasRaw)) {
    for (const [cat, items] of Object.entries(extrasRaw as Record<string, unknown>)) {
      if (!Array.isArray(items)) continue;
      extras[cat] = items.map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null && 'label' in item) {
          return (item as { label: string }).label;
        }
        return '';
      }).filter(Boolean);
    }
  }

  const engineCc = row.engine?.match(/(\d{3,5})/)?.[1] ?? '';

  return NextResponse.json({
    form: {
      dealerId: String(row.dealer_id),
      pubtype: techData.pubtype || '1,2',
      make: row.make ?? '',
      model: row.model ?? '',
      title: row.title ?? '',
      fuel: row.fuel ?? '',
      condition: techData.f25 || '0',
      power: row.power != null ? String(row.power) : '',
      euronorm: techData.f29 ? `Евро ${techData.f29}` : '',
      transmission: row.transmission ?? '',
      bodyType: row.category ?? '',
      engineCc,
      batteryRange: techData.f33 || '',
      batteryCapacity: techData.f34 || '',
      price: row.price_amount != null ? String(row.price_amount) : '',
      vat: getMobileBgVatLabel(row.vat_included) ?? '',
      currency: techData.f13 || row.price_currency || 'EUR',
      mileage: row.mileage != null ? String(row.mileage) : '',
      productionMonth: techData.f14 || '',
      productionYear: techData.f15 || (row.year != null ? String(row.year) : ''),
      color: row.color ?? '',
      region: techData.region || '',
      city: techData.city || '',
      vin: normalizeVin(techData.f32),
      description: row.description ?? '',
      phone: techData.f22 || phones[0] || '',
      email: techData.f23 || '',
      website: techData.f24 || '',
      priceOnRequest: techData.priceneg === '99999999',
      extras,
    },
  });
}
