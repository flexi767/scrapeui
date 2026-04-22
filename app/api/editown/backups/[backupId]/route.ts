import { NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { getMobileBgVatLabel, getVatFromMobileBgLabel, normalizeVatValue } from '@/lib/vat';

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

function inferBatteryRangeKm(fuel: string | null, description: string | null): string {
  if (!fuel?.toLowerCase().includes('електр')) return '';
  const match = (description || '').match(
    /(?:wltp|зареждане|пробег)[^\d]{0,80}(\d{2,4})(?:\s*[-–]\s*(\d{2,4}))?\s*(?:км|km)/iu,
  );
  return match ? (match[2] || match[1]) : '';
}

function inferBatteryCapacityKwh(
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

interface FullFormBody {
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

function parseString(value: unknown, label: string, required = false): string | null {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`);
  }
  const trimmed = value.trim();
  if (required && !trimmed) {
    throw new Error(`${label} is required`);
  }
  return trimmed || null;
}

function parseNonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

function parseBinaryInteger(value: unknown, label: string): number {
  if (value !== 0 && value !== 1) {
    throw new Error(`${label} must be 0 or 1`);
  }
  return value;
}

function parseAdStatus(value: unknown): string {
  if (typeof value !== 'string' || !['none', 'TOP', 'VIP'].includes(value)) {
    throw new Error('Invalid ad_status value');
  }
  return value;
}

function isFullFormBody(
  value: Record<string, unknown>,
): value is Record<string, unknown> & FullFormBody {
  return typeof value.dealerId === 'string' && typeof value.make === 'string';
}

function buildTechData(body: FullFormBody): string | null {
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

function buildExtrasJson(body: FullFormBody): string | null {
  return body.extras && Object.keys(body.extras).length > 0
    ? JSON.stringify(body.extras)
    : null;
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
      batteryRange: techData.f33 || inferBatteryRangeKm(row.fuel, row.description),
      batteryCapacity: techData.f34 || inferBatteryCapacityKwh(
        row.fuel,
        row.make,
        row.model,
        row.title,
        row.description,
      ),
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ backupId: string }> },
) {
  try {
    const { backupId: backupIdParam } = await params;
    const backupId = Number(backupIdParam);
    if (!Number.isInteger(backupId) || backupId <= 0) {
      return NextResponse.json({ error: 'Invalid backup ID' }, { status: 400 });
    }

    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!payload) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (isFullFormBody(payload)) {
      if (!payload.dealerId) {
        return NextResponse.json({ error: 'dealerId required' }, { status: 400 });
      }
      if (!payload.make) {
        return NextResponse.json({ error: 'make required' }, { status: 400 });
      }
      if (!payload.price && !payload.priceOnRequest) {
        return NextResponse.json(
          { error: 'price required unless priceOnRequest is true' },
          { status: 400 },
        );
      }

      const backup = raw.prepare(`
        SELECT id
        FROM mobilebg_backups
        WHERE id = ?
        LIMIT 1
      `).get(backupId) as { id: number } | undefined;

      if (!backup) {
        return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
      }

      const bodyType = payload.body_type ?? payload.bodyType ?? '';
      const productionYear = payload.productionYear ?? '';
      const now = new Date().toISOString();

      raw.prepare(`
        UPDATE mobilebg_backups
        SET
          dealer_id = ?,
          source_title = ?,
          make = ?,
          model = ?,
          title = ?,
          price_amount = ?,
          year = ?,
          mileage = ?,
          fuel = ?,
          power = ?,
          engine = ?,
          color = ?,
          transmission = ?,
          category = ?,
          description = ?,
          vat_included = ?,
          extras_json = ?,
          tech_data_json = ?,
          draft_needs_sync = CASE WHEN listing_id IS NULL THEN draft_needs_sync ELSE 1 END,
          last_mobile_sync_status = CASE WHEN listing_id IS NULL THEN last_mobile_sync_status ELSE 'pending' END,
          last_mobile_sync_error = CASE WHEN listing_id IS NULL THEN last_mobile_sync_error ELSE NULL END,
          updated_at = ?
        WHERE id = ?
      `).run(
        Number(payload.dealerId),
        payload.title || null,
        payload.make || null,
        payload.model || null,
        payload.title || null,
        payload.price ? Number(payload.price) : null,
        productionYear ? Number(productionYear) : null,
        payload.mileage ? Number(payload.mileage) : null,
        payload.fuel || null,
        payload.power ? Number(payload.power) : null,
        payload.engineCc ? `${payload.engineCc} куб.см` : null,
        payload.color || null,
        payload.transmission || null,
        bodyType || null,
        payload.description || null,
        getVatFromMobileBgLabel(payload.vat),
        buildExtrasJson(payload),
        buildTechData(payload),
        now,
        backupId,
      );

      return NextResponse.json({ id: backupId, updated: true });
    }

    const title = parseString(payload.title, 'Title', true);
    const priceAmount = parseNonNegativeInteger(payload.current_price, 'Price');
    const vatIncluded = normalizeVatValue(payload.vat);
    const kaparo = parseBinaryInteger(payload.kaparo, 'Kaparo');
    const adStatus = parseAdStatus(payload.ad_status);

    const backup = raw.prepare(`
      SELECT id
      FROM mobilebg_backups
      WHERE id = ?
      LIMIT 1
    `).get(backupId) as { id: number } | undefined;

    if (!backup) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    raw.prepare(`
      UPDATE mobilebg_backups
      SET
        title = ?,
        price_amount = ?,
        vat_included = ?,
        kaparo = ?,
        ad_status = ?,
        draft_needs_sync = 1,
        last_mobile_sync_status = 'pending',
        last_mobile_sync_error = NULL,
        updated_at = ?
      WHERE id = ?
    `).run(title, priceAmount, vatIncluded, kaparo, adStatus, now, backupId);

    return NextResponse.json({
      backup_id: backupId,
      title,
      current_price: priceAmount,
      vat: vatIncluded,
      kaparo,
      ad_status: adStatus,
      needs_sync: 1,
      last_mobile_sync_status: 'pending',
      last_mobile_sync_error: null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Save failed' },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ backupId: string }> },
) {
  const { backupId: backupIdParam } = await params;
  const backupId = Number(backupIdParam);
  if (!Number.isInteger(backupId) || backupId <= 0) {
    return NextResponse.json({ error: 'Invalid backup ID' }, { status: 400 });
  }

  const backup = raw.prepare(`
    SELECT id, listing_id
    FROM mobilebg_backups
    WHERE id = ?
    LIMIT 1
  `).get(backupId) as { id: number; listing_id: string | null } | undefined;

  if (!backup) {
    return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
  }

  if (backup.listing_id) {
    return NextResponse.json(
      { error: 'Only draft listings without a mobile.bg ID can be deleted here' },
      { status: 400 },
    );
  }

  const deleteDraft = raw.transaction((id: number) => {
    raw.prepare('DELETE FROM mobilebg_backup_images WHERE backup_id = ?').run(id);
    raw.prepare('DELETE FROM mobilebg_edit_form_snapshots WHERE backup_id = ?').run(id);
    raw.prepare('DELETE FROM mobilebg_repost_jobs WHERE backup_id = ?').run(id);
    raw.prepare('DELETE FROM mobilebg_backups WHERE id = ?').run(id);
  });

  deleteDraft(backupId);

  return NextResponse.json({ ok: true, backup_id: backupId });
}
