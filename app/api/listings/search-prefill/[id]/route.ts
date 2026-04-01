import { NextResponse } from 'next/server';
import { raw } from '@/db/client';

export const runtime = 'nodejs';

interface ListingSearchRow {
  id: number;
  title: string | null;
  make: string | null;
  model: string | null;
  reg_year: string | null;
  fuel: string | null;
  transmission: string | null;
  body_type: string | null;
  mileage: number | null;
  current_price: number | null;
}

interface ReferenceRow {
  make_count: number | null;
  model_count: number | null;
}

interface SearchField {
  name: string;
  label: string;
  value: string;
  source: 'default' | 'listing' | 'derived';
}

const SEARCH_ACTION = 'https://www.mobile.bg/pcgi/mobile.cgi';
const ALLOWED_FUELS = new Set([
  'Бензинов',
  'Дизелов',
  'Електрически',
  'Хибриден',
  'Plug-in хибрид',
  'Газ',
  'Водород',
]);
const ALLOWED_TRANSMISSIONS = new Set([
  'Ръчна',
  'Автоматична',
  'Полуавтоматична',
]);
const ALLOWED_CATEGORIES = new Set([
  'Ван',
  'Джип',
  'Кабрио',
  'Комби',
  'Купе',
  'Миниван',
  'Пикап',
  'Седан',
  'Стреч лимузина',
  'Хечбек',
]);

function toMileageBucket(value: number | null): string | null {
  if (!value || value <= 0) return null;
  const limits = [
    10000, 20000, 30000, 40000, 50000, 60000, 70000, 80000, 90000,
    100000, 110000, 120000, 130000, 140000, 150000, 200000, 250000, 300000,
  ];
  for (const limit of limits) {
    if (value <= limit) return String(limit);
  }
  return '>300000';
}

function addField(
  fields: SearchField[],
  name: string,
  label: string,
  value: string | null | undefined,
  source: SearchField['source'],
) {
  if (!value) return;
  fields.push({ name, label, value, source });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const listingId = Number.parseInt((await params).id, 10);
  if (!Number.isFinite(listingId)) {
    return NextResponse.json({ error: 'Invalid listing id' }, { status: 400 });
  }

  const listing = raw.prepare(`
    SELECT
      id,
      title,
      make,
      model,
      reg_year,
      fuel,
      transmission,
      body_type,
      mileage,
      current_price
    FROM listings
    WHERE id = ?
    LIMIT 1
  `).get(listingId) as ListingSearchRow | undefined;

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  const makeReference = raw.prepare(`
    SELECT make_count, model_count
    FROM mobilebg_make_models
    WHERE make = ? AND model = ''
    LIMIT 1
  `).get(listing.make ?? '') as ReferenceRow | undefined;

  const modelReference = raw.prepare(`
    SELECT make_count, model_count
    FROM mobilebg_make_models
    WHERE make = ? AND model = ?
    LIMIT 1
  `).get(listing.make ?? '', listing.model ?? '') as ReferenceRow | undefined;

  const fields: SearchField[] = [
    { name: 'topmenu', label: 'Top menu', value: '1', source: 'default' },
    { name: 'rub', label: 'Rubric', value: '1', source: 'default' },
    { name: 'act', label: 'Action', value: '2', source: 'default' },
    { name: 'rub_pub_save', label: 'Saved rubric', value: '1', source: 'default' },
    { name: 'pubtype', label: 'Category', value: '1', source: 'default' },
  ];
  const visibleFields: SearchField[] = [];
  const omitted: string[] = [];

  addField(visibleFields, 'marka', 'Марка', listing.make, 'listing');
  addField(visibleFields, 'model', 'Модел', listing.model, 'listing');

  if (listing.reg_year && /^\d{4}$/.test(listing.reg_year)) {
    addField(visibleFields, 'f10', 'Година от', listing.reg_year, 'listing');
    addField(visibleFields, 'f11', 'Година до', listing.reg_year, 'listing');
  } else {
    omitted.push('Year was missing or invalid.');
  }

  if (listing.fuel && ALLOWED_FUELS.has(listing.fuel)) {
    addField(visibleFields, 'f12', 'Двигател', listing.fuel, 'listing');
  } else if (listing.fuel) {
    omitted.push(`Fuel "${listing.fuel}" does not match a known mobile.bg search option.`);
  }

  if (listing.transmission && ALLOWED_TRANSMISSIONS.has(listing.transmission)) {
    addField(visibleFields, 'f13', 'Скоростна кутия', listing.transmission, 'listing');
  } else if (listing.transmission) {
    omitted.push(`Transmission "${listing.transmission}" does not match a known mobile.bg search option.`);
  }

  if (listing.body_type && ALLOWED_CATEGORIES.has(listing.body_type)) {
    addField(visibleFields, 'f14', 'Категория', listing.body_type, 'listing');
  } else if (listing.body_type) {
    omitted.push(`Body type "${listing.body_type}" does not match a supported mobile.bg category.`);
  }

  const mileageBucket = toMileageBucket(listing.mileage);
  if (mileageBucket) {
    addField(visibleFields, 'f15', 'Макс. пробег', mileageBucket, 'derived');
  } else if (listing.mileage != null) {
    omitted.push('Mileage was outside the supported mobile.bg buckets.');
  }

  fields.push(...visibleFields);

  return NextResponse.json({
    listing: {
      id: listing.id,
      title: listing.title,
      make: listing.make,
      model: listing.model,
      regYear: listing.reg_year,
      fuel: listing.fuel,
      transmission: listing.transmission,
      bodyType: listing.body_type,
      mileage: listing.mileage,
      currentPrice: listing.current_price,
    },
    form: {
      action: SEARCH_ACTION,
      method: 'POST',
      fields,
      visibleFields,
    },
    reference: {
      makeCount: modelReference?.make_count ?? makeReference?.make_count ?? null,
      modelCount: modelReference?.model_count ?? null,
    },
    omitted,
  });
}
