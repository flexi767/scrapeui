import { NextRequest, NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { getVatFromMobileBgLabel } from '@/lib/vat';

interface NewListingBody {
  dealerId: string;
  pubtype: string;
  make: string;
  model: string;
  body_type?: string;
  bodyType?: string;
  fuel: string;
  transmission: string;
  year: string;
  mileage: string;
  power: string;
  engineCc: string;
  color: string;
  region: string;
  city: string;
  price: string;
  vat: string;
  title: string;
  description: string;
  extras: Record<string, string[]>;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as NewListingBody;
  const bodyType = body.body_type ?? body.bodyType ?? '';

  if (!body.dealerId) return NextResponse.json({ error: 'dealerId required' }, { status: 400 });
  if (!body.make)     return NextResponse.json({ error: 'make required' }, { status: 400 });
  if (!body.price)    return NextResponse.json({ error: 'price required' }, { status: 400 });

  const now = new Date().toISOString();

  // Save as a mobilebg_backup record (own dealer draft — no mobileId yet)
  const techDataPayload: Record<string, string> = {};
  if (body.pubtype) techDataPayload.pubtype = body.pubtype;
  if (body.region) techDataPayload.region = body.region;
  if (body.city) techDataPayload.city = body.city;
  const techData = Object.keys(techDataPayload).length > 0
    ? JSON.stringify(techDataPayload)
    : null;
  const extrasJson = body.extras && Object.keys(body.extras).length > 0
    ? JSON.stringify(body.extras)
    : null;

  const result = raw.prepare(`
    INSERT INTO mobilebg_backups (
      dealer_id, source_title, make, model, title,
      price_amount, year, mileage, fuel, power, engine,
      color, transmission, category, description,
      vat_included, extras_json, tech_data_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    Number(body.dealerId),
    body.title || null,
    body.make || null,
    body.model || null,
    body.title || null,
    body.price ? Number(body.price) : null,
    body.year ? Number(body.year) : null,
    body.mileage ? Number(body.mileage) : null,
    body.fuel || null,
    body.power ? Number(body.power) : null,
    body.engineCc ? `${body.engineCc} куб.см` : null,
    body.color || null,
    body.transmission || null,
    bodyType || null,
    body.description || null,
    getVatFromMobileBgLabel(body.vat),
    extrasJson,
    techData,
    now,
    now,
  );

  return NextResponse.json({ id: result.lastInsertRowid });
}
