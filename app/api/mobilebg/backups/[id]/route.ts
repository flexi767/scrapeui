import { NextResponse } from 'next/server';
import { raw } from '@/db/client';

function parseOptionalInteger(value: unknown, label: string): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

function parseOptionalString(value: unknown, label: string, required = false): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`);
  }
  const trimmed = value.trim();
  if (required && !trimmed) {
    throw new Error(`${label} is required`);
  }
  return trimmed || null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const backupId = Number((await params).id);
    if (!Number.isInteger(backupId) || backupId <= 0) {
      return NextResponse.json({ error: 'Invalid backup ID' }, { status: 400 });
    }

    const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!payload) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const title = parseOptionalString(payload.title, 'Title', true);
    const priceAmount = parseOptionalInteger(payload.price_amount, 'Price');
    const vatIncluded = payload.vat_included == null
      ? null
      : payload.vat_included === 0 || payload.vat_included === 1
        ? payload.vat_included
        : (() => { throw new Error('VAT must be 0, 1, or null'); })();
    const year = parseOptionalInteger(payload.year, 'Year');
    const mileage = parseOptionalInteger(payload.mileage, 'Mileage');
    const fuel = parseOptionalString(payload.fuel, 'Fuel');
    const power = parseOptionalInteger(payload.power, 'Power');
    const engine = parseOptionalString(payload.engine, 'Engine');
    const color = parseOptionalString(payload.color, 'Color');
    const transmission = parseOptionalString(payload.transmission, 'Transmission');
    const category = parseOptionalString(payload.category, 'Category');
    const description = parseOptionalString(payload.description, 'Description');

    const backup = raw.prepare(`
      SELECT id, listing_id
      FROM mobilebg_backups
      WHERE id = ?
      LIMIT 1
    `).get(backupId) as { id: number; listing_id: number | null } | undefined;

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
        year = ?,
        mileage = ?,
        fuel = ?,
        power = ?,
        engine = ?,
        color = ?,
        transmission = ?,
        category = ?,
        description = ?,
        draft_needs_sync = 1,
        updated_at = ?
      WHERE id = ?
    `).run(
      title,
      priceAmount,
      vatIncluded,
      year,
      mileage,
      fuel,
      power,
      engine,
      color,
      transmission,
      category,
      description,
      now,
      backupId,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 400 },
    );
  }
}
