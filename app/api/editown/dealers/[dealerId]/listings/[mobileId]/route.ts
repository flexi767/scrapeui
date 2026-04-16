import { NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { getMobileBgVatLabel } from '@/lib/vat';

interface PrefillRow {
  dealer_id: number;
  mobile_id: string;
  make: string | null;
  model: string | null;
  title: string | null;
  fuel: string | null;
  power: number | null;
  transmission: string | null;
  body_type: string | null;
  mileage: number | null;
  color: string | null;
  description: string | null;
  price_amount: number | null;
  price_currency: string | null;
  vat_value: string | null;
  year: number | null;
  reg_month: string | null;
  engine: string | null;
  vin: string | null;
  euronorm: number | null;
  phones_json: string | null;
  extras_json: string | null;
  tech_data_json: string | null;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toEuroNormLabel(value: string | number | null | undefined): string {
  if (value == null || value === '') return '';
  return `Евро ${String(value).trim()}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dealerId: string; mobileId: string }> },
) {
  const { dealerId: dealerIdParam, mobileId } = await params;
  const dealerId = Number(dealerIdParam);
  if (!Number.isInteger(dealerId) || dealerId <= 0) {
    return NextResponse.json({ error: 'Invalid dealer ID' }, { status: 400 });
  }

  const row = raw.prepare(`
    WITH ranked_backups AS (
      SELECT
        b.*,
        ROW_NUMBER() OVER (
          PARTITION BY b.dealer_id, b.mobile_id
          ORDER BY COALESCE(b.updated_at, b.created_at) DESC, b.id DESC
        ) as row_num
      FROM mobilebg_backups b
    )
    SELECT
      l.dealer_id,
      l.mobile_id,
      COALESCE(b.make, l.make) as make,
      COALESCE(b.model, l.model) as model,
      COALESCE(b.source_title, b.title, l.title) as title,
      COALESCE(b.fuel, l.fuel) as fuel,
      COALESCE(b.power, l.power) as power,
      COALESCE(b.transmission, l.transmission) as transmission,
      COALESCE(b.category, l.body_type) as body_type,
      COALESCE(b.mileage, l.mileage) as mileage,
      COALESCE(b.color, l.color) as color,
      COALESCE(b.description, l.description) as description,
      COALESCE(b.price_amount, l.current_price) as price_amount,
      COALESCE(b.price_currency, 'EUR') as price_currency,
      COALESCE(b.vat_included, l.vat) as vat_value,
      COALESCE(b.year, CAST(NULLIF(l.reg_year, '') AS INTEGER)) as year,
      l.reg_month,
      b.engine,
      COALESCE(NULLIF(l.vin, ''), NULL) as vin,
      l.euronorm,
      b.phones_json,
      COALESCE(b.extras_json, l.extras_json) as extras_json,
      b.tech_data_json
    FROM listings l
    LEFT JOIN ranked_backups b
      ON b.dealer_id = l.dealer_id
      AND b.mobile_id = l.mobile_id
      AND b.row_num = 1
    WHERE l.dealer_id = ?
      AND l.mobile_id = ?
      AND COALESCE(l.source, 'm') = 'm'
    LIMIT 1
  `).get(dealerId, mobileId) as PrefillRow | undefined;

  if (!row) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  const techData = parseJson<Record<string, string>>(row.tech_data_json, {});
  const extras = parseJson<Record<string, string[]>>(row.extras_json, {});
  const phones = parseJson<string[]>(row.phones_json, []);
  const engineMatch = row.engine?.match(/(\d{3,5})/);

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
      euronorm: toEuroNormLabel(techData.f29 || row.euronorm),
      transmission: row.transmission ?? '',
      bodyType: row.body_type ?? '',
      engineCc: engineMatch?.[1] ?? '',
      batteryRange: techData.f33 || '',
      batteryCapacity: techData.f34 || '',
      price: row.price_amount != null ? String(row.price_amount) : '',
      vat: getMobileBgVatLabel(row.vat_value) ?? '',
      currency: techData.f13 || row.price_currency || 'EUR',
      mileage: row.mileage != null ? String(row.mileage) : '',
      productionMonth: techData.f14 || row.reg_month || '',
      productionYear: techData.f15 || (row.year != null ? String(row.year) : ''),
      color: row.color ?? '',
      region: techData.region || '',
      city: techData.city || '',
      vin: techData.f32 || row.vin || '',
      description: row.description ?? '',
      phone: techData.f22 || phones[0] || '',
      email: techData.f23 || '',
      website: techData.f24 || '',
      priceOnRequest: techData.priceneg === '99999999',
      extras,
    },
  });
}
