import { NextRequest, NextResponse } from 'next/server';
import { raw } from '@/db/client';

interface NewListingBody {
  dealerId: string;
  pubtype: string;
  make: string;
  model: string;
  bodyType: string;
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

  if (!body.dealerId) return NextResponse.json({ error: 'dealerId required' }, { status: 400 });
  if (!body.make)     return NextResponse.json({ error: 'make required' }, { status: 400 });
  if (!body.price)    return NextResponse.json({ error: 'price required' }, { status: 400 });

  const now = new Date().toISOString();

  // Save as a mobilebg_backup record (own dealer draft — no mobileId yet)
  const techData = body.pubtype ? JSON.stringify({ pubtype: body.pubtype }) : null;
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
    body.bodyType || null,
    body.description || null,
    body.vat ? (body.vat.includes('включено') ? 1 : 0) : null,
    extrasJson,
    techData,
    now,
    now,
  );

  return NextResponse.json({ id: result.lastInsertRowid });
}
