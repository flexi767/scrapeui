import { NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { requireDealerScope } from '@/lib/api/auth-helpers';
import { getMobileBgVatLabel } from '@/lib/vat';
import { parseJson, normalizeVin } from '@/lib/utils';
import { normalizeExtras } from '@/lib/mobile-bg/extras';
import { ownEditableSelectExprs, rankedBackupsCte } from '@/lib/query-modules/types';
import { parsePositiveIntParam } from '@/lib/api/db-helpers';

const MONTH_NAMES = [
  '',
  'януари', 'февруари', 'март', 'април', 'май', 'юни',
  'юли', 'август', 'септември', 'октомври', 'ноември', 'декември',
];


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
  snapshot_fields_json: string | null;
  snapshot_checked_json: string | null;
}

function toEuroNormLabel(value: string | number | null | undefined): string {
  if (value == null || value === '') return '';
  return `Евро ${String(value).trim()}`;
}

function pickVin(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    const vin = normalizeVin(candidate);
    if (vin) return vin;
  }
  return '';
}

// Extracts the value of a named field from the flat fields_json array in edit form snapshots
function snapshotField(
  fields: Array<{ name?: string; value?: string }>,
  name: string,
): string {
  return fields.find((f) => f.name === name)?.value?.trim() ?? '';
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dealerId: string; mobileId: string }> },
) {
  const { dealerId: dealerIdParam, mobileId } = await params;
  const dealerId = parsePositiveIntParam(dealerIdParam);
  if (!dealerId) {
    return NextResponse.json({ error: 'Invalid dealer ID' }, { status: 400 });
  }

  const check = await requireDealerScope(dealerId);
  if ('error' in check) return check.error;

  const row = raw.prepare(`
    ${rankedBackupsCte}
    SELECT
      l.dealer_id,
      l.mobile_id,
      ${ownEditableSelectExprs.make} as make,
      ${ownEditableSelectExprs.model} as model,
      ${ownEditableSelectExprs.title} as title,
      ${ownEditableSelectExprs.fuel} as fuel,
      ${ownEditableSelectExprs.power} as power,
      ${ownEditableSelectExprs.transmission} as transmission,
      ${ownEditableSelectExprs.bodyType} as body_type,
      ${ownEditableSelectExprs.mileage} as mileage,
      ${ownEditableSelectExprs.color} as color,
      ${ownEditableSelectExprs.description} as description,
      ${ownEditableSelectExprs.price} as price_amount,
      ${ownEditableSelectExprs.priceCurrency} as price_currency,
      ${ownEditableSelectExprs.vat} as vat_value,
      COALESCE(b.year, CAST(NULLIF(l.reg_year, '') AS INTEGER)) as year,
      l.reg_month,
      b.engine,
      COALESCE(NULLIF(l.vin, ''), NULL) as vin,
      l.euronorm,
      b.phones_json,
      ${ownEditableSelectExprs.extrasJson} as extras_json,
      b.tech_data_json,
      s.fields_json as snapshot_fields_json,
      s.checked_boxes_json as snapshot_checked_json
    FROM listings l
    LEFT JOIN ranked_backups b
      ON b.dealer_id = l.dealer_id
      AND b.mobile_id = l.mobile_id
      AND b.row_num = 1
    LEFT JOIN (
      SELECT dealer_id, mobile_id, fields_json, checked_boxes_json
      FROM mobilebg_edit_form_snapshots
      WHERE (dealer_id, mobile_id, created_at) IN (
        SELECT dealer_id, mobile_id, MAX(created_at)
        FROM mobilebg_edit_form_snapshots
        GROUP BY dealer_id, mobile_id
      )
    ) s ON s.dealer_id = l.dealer_id AND s.mobile_id = l.mobile_id
    WHERE l.dealer_id = ?
      AND l.mobile_id = ?
      AND COALESCE(l.source, 'm') = 'm'
    LIMIT 1
  `).get(dealerId, mobileId) as PrefillRow | undefined;

  if (!row) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  // Parse all three sources
  const snap = parseJson<Array<{ name?: string; value?: string }>>(
    row.snapshot_fields_json,
    [],
  );
  const snapChecked = parseJson<Array<{ name?: string; value?: string }>>(
    row.snapshot_checked_json,
    [],
  );
  const techData = parseJson<Record<string, string>>(row.tech_data_json, {});
  const phones = parseJson<string[]>(row.phones_json, []);

  // Helper: snapshot field → backup tech_data f-key → backup tech_data Bulgarian key → fallback
  const sf = (fcode: string) => snapshotField(snap, fcode);

  // Extras: snapshot checked_boxes_json is the cleanest source (flat string[] of checked labels)
  // Fall back to backup/listings extras_json (which normalizeExtras handles)
  const extrasFromSnapshot = snapChecked.length > 0
    ? normalizeExtras(snapChecked.map((f) => f.value ?? '').filter(Boolean))
    : null;
  const extrasFromBackup = normalizeExtras(parseJson<unknown>(row.extras_json, null));
  const extras = extrasFromSnapshot ?? extrasFromBackup;

  // Кубатура: snapshot f30 → backup engine regex → Bulgarian tech_data key
  const engineCc =
    sf('f30') ||
    row.engine?.match(/(\d{3,5})/)?.[1] ||
    techData['Кубатура [куб.см]']?.match(/(\d{3,5})/)?.[1] ||
    '';

  // Месец: snapshot f14 (already Bulgarian name) → backup tech_data f14
  //        → numeric reg_month converted to name → Bulgarian display date
  const regMonthIndex = parseInt(row.reg_month ?? '0', 10);
  const regMonthName = MONTH_NAMES[regMonthIndex] ?? '';
  const bgDateMonth = techData['Дата на производство']?.split(' ')[0] ?? '';
  const productionMonth = sf('f14') || techData.f14 || regMonthName || bgDateMonth;

  // Евростандарт: snapshot f29 may be bare number; wrap it
  const euronorm =
    toEuroNormLabel(sf('f29') || techData.f29 || row.euronorm) ||
    techData['Евростандарт'] ||
    '';

  return NextResponse.json({
    form: {
      dealerId: String(row.dealer_id),
      pubtype: sf('f28') || techData.pubtype || '1,2',
      make: row.make ?? '',
      model: row.model ?? '',
      title: row.title ?? '',
      fuel: row.fuel ?? '',
      condition: sf('f25') || techData.f25 || '0',
      power: row.power != null ? String(row.power) : '',
      euronorm,
      transmission: row.transmission ?? '',
      bodyType: row.body_type ?? '',
      engineCc,
      batteryRange: sf('f33') || techData.f33 || '',
      batteryCapacity: sf('f34') || techData.f34 || '',
      price: row.price_amount != null ? String(row.price_amount) : '',
      vat: getMobileBgVatLabel(row.vat_value) ?? '',
      currency: sf('f13') || techData.f13 || row.price_currency || 'EUR',
      mileage: row.mileage != null ? String(row.mileage) : '',
      productionMonth,
      productionYear: sf('f15') || techData.f15 || (row.year != null ? String(row.year) : ''),
      color: row.color ?? '',
      region: techData.region || sf('f18'),
      city: techData.city || sf('f19'),
      vin: pickVin(techData.f32, row.vin, sf('f20')),
      description: row.description ?? '',
      phone: techData.f22 || phones[0] || sf('f22'),
      email: techData.f23 || sf('f23'),
      website: techData.f24 || sf('f24'),
      priceOnRequest: techData.priceneg === '99999999',
      extras,
    },
  });
}
