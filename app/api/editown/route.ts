import { NextRequest, NextResponse } from 'next/server';
import { requireApiPagePermission } from '@/lib/api/auth-helpers';
import { raw } from '@/db/client';
import { currentIsoTimestamp } from '@/lib/date-format';
import { runInsert } from '@/lib/listings/sql';
import {
  buildExtrasJson,
  buildTechData,
  getFullFormVat,
  type FullFormBody,
} from '@/app/api/editown/backups/[backupId]/helpers';

export async function POST(req: NextRequest) {
  const check = await requireApiPagePermission('editown');
  if ('error' in check) return check.error;

  const body = await req.json() as FullFormBody;
  const bodyType = body.body_type ?? body.bodyType ?? '';
  const productionYear = body.productionYear ?? '';

  if (!body.dealerId) return NextResponse.json({ error: 'dealerId required' }, { status: 400 });
  if (!body.make)     return NextResponse.json({ error: 'make required' }, { status: 400 });
  if (!body.price && !body.priceOnRequest) {
    return NextResponse.json({ error: 'price required unless priceOnRequest is true' }, { status: 400 });
  }

  const now = currentIsoTimestamp();
  const result = runInsert(raw, 'mobilebg_backups', {
    dealer_id: Number(body.dealerId),
    source_title: body.title || null,
    make: body.make || null,
    model: body.model || null,
    title: body.title || null,
    price_amount: body.price ? Number(body.price) : null,
    year: productionYear ? Number(productionYear) : null,
    mileage: body.mileage ? Number(body.mileage) : null,
    fuel: body.fuel || null,
    power: body.power ? Number(body.power) : null,
    engine: body.engineCc ? `${body.engineCc} куб.см` : null,
    color: body.color || null,
    transmission: body.transmission || null,
    category: bodyType || null,
    description: body.description || null,
    vat_included: getFullFormVat(body),
    extras_json: buildExtrasJson(body),
    tech_data_json: buildTechData(body),
    created_at: now,
    updated_at: now,
  });

  return NextResponse.json({ id: result.lastInsertRowid });
}
