import { NextRequest, NextResponse } from 'next/server';
import { raw } from '@/db/client';
import { getVatFromMobileBgLabel } from '@/lib/vat';

interface NewListingBody {
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

export async function POST(req: NextRequest) {
  const body = await req.json() as NewListingBody;
  const bodyType = body.body_type ?? body.bodyType ?? '';
  const productionYear = body.productionYear ?? '';

  if (!body.dealerId) return NextResponse.json({ error: 'dealerId required' }, { status: 400 });
  if (!body.make)     return NextResponse.json({ error: 'make required' }, { status: 400 });
  if (!body.price && !body.priceOnRequest) {
    return NextResponse.json({ error: 'price required unless priceOnRequest is true' }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Save as a mobilebg_backup record (own dealer draft — no mobileId yet)
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
    productionYear ? Number(productionYear) : null,
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
