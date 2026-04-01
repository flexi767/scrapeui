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
  power: number | null;
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

interface ReferenceOption {
  value: string;
  count: number | null;
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
      power,
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

  const makeOptions = raw.prepare(`
    SELECT make as value, make_count as count
    FROM mobilebg_make_models
    WHERE model = ''
    ORDER BY make
  `).all() as ReferenceOption[];

  const modelRows = raw.prepare(`
    SELECT make, model as value, model_count as count
    FROM mobilebg_make_models
    WHERE model != ''
    ORDER BY make, model
  `).all() as Array<ReferenceOption & { make: string }>;

  const modelsByMake = modelRows.reduce<Record<string, ReferenceOption[]>>((acc, row) => {
    if (!acc[row.make]) acc[row.make] = [];
    acc[row.make].push({ value: row.value, count: row.count });
    return acc;
  }, {});

  const fields: SearchField[] = [
    { name: 'topmenu', label: 'Top menu', value: '1', source: 'default' },
    { name: 'rub', label: 'Rubric', value: '1', source: 'default' },
    { name: 'act', label: 'Action', value: '2', source: 'default' },
    { name: 'rub_pub_save', label: 'Saved rubric', value: '1', source: 'default' },
    { name: 'pubtype', label: 'Category', value: '1', source: 'default' },
    { name: 'f20', label: 'Сортиране според', value: '3', source: 'default' },
  ];
  const visibleFields: SearchField[] = [];
  const omitted: string[] = [];

  addField(visibleFields, 'marka', 'Марка', listing.make, 'listing');
  addField(visibleFields, 'model', 'Модел', listing.model, 'listing');

  if (listing.reg_year && /^\d{4}$/.test(listing.reg_year)) {
    const year = Number.parseInt(listing.reg_year, 10);
    addField(visibleFields, 'f10', 'Година от', String(year - 1), 'derived');
    addField(visibleFields, 'f11', 'Година до', String(year + 1), 'derived');
  } else {
    omitted.push('Year was missing or invalid.');
  }

  visibleFields.push({
    name: 'f12',
    label: 'Двигател',
    value: listing.fuel && ALLOWED_FUELS.has(listing.fuel) ? listing.fuel : '',
    source: listing.fuel && ALLOWED_FUELS.has(listing.fuel) ? 'listing' : 'default',
  });
  if (listing.fuel && !ALLOWED_FUELS.has(listing.fuel)) {
    omitted.push(`Fuel "${listing.fuel}" does not match a known mobile.bg search option.`);
  }

  visibleFields.push({
    name: 'f13',
    label: 'Скоростна кутия',
    value: listing.transmission && ALLOWED_TRANSMISSIONS.has(listing.transmission) ? listing.transmission : '',
    source: listing.transmission && ALLOWED_TRANSMISSIONS.has(listing.transmission) ? 'listing' : 'default',
  });
  if (listing.transmission && !ALLOWED_TRANSMISSIONS.has(listing.transmission)) {
    omitted.push(`Transmission "${listing.transmission}" does not match a known mobile.bg search option.`);
  }

  visibleFields.push({
    name: 'f14',
    label: 'Категория',
    value: listing.body_type && ALLOWED_CATEGORIES.has(listing.body_type) ? listing.body_type : '',
    source: listing.body_type && ALLOWED_CATEGORIES.has(listing.body_type) ? 'listing' : 'default',
  });
  if (listing.body_type && !ALLOWED_CATEGORIES.has(listing.body_type)) {
    omitted.push(`Body type "${listing.body_type}" does not match a supported mobile.bg category.`);
  }

  if (listing.power != null && listing.power > 0) {
    addField(visibleFields, 'f25', 'Мощност от [к.с.]', String(Math.max(0, listing.power - 5)), 'derived');
    addField(visibleFields, 'f26', 'Мощност до [к.с.]', String(listing.power + 5), 'derived');
  }

  if (listing.current_price != null && listing.current_price > 0) {
    addField(
      visibleFields,
      'f7',
      'Цена от',
      String(Math.max(0, Math.floor(listing.current_price * 0.9))),
      'derived',
    );
    addField(
      visibleFields,
      'f8',
      'Цена до',
      String(Math.ceil(listing.current_price * 1.1)),
      'derived',
    );
    addField(visibleFields, 'f9', 'Валута', 'EUR', 'default');
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
      body_type: listing.body_type,
      power: listing.power,
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
    options: {
      makes: makeOptions,
      modelsByMake,
    },
    omitted,
  });
}
