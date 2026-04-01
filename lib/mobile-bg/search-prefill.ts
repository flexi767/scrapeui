import { raw } from '@/db/client';
import { load } from 'cheerio';
import iconv from 'iconv-lite';

interface ListingSearchRow {
  id: number;
  mobile_id: string | null;
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

export interface SearchField {
  name: string;
  label: string;
  value: string;
  source: 'default' | 'listing' | 'derived';
}

interface ReferenceOption {
  value: string;
  count: number | null;
}

interface LabeledOption {
  value: string;
  label: string;
}

export interface SearchPrefillData {
  listing: {
    id: number;
    mobile_id: string | null;
    title: string | null;
    make: string | null;
    model: string | null;
    regYear: string | null;
    fuel: string | null;
    transmission: string | null;
    body_type: string | null;
    power: number | null;
    mileage: number | null;
    currentPrice: number | null;
  };
  form: {
    action: string;
    method: 'POST';
    fields: SearchField[];
    visibleFields: SearchField[];
  };
  reference: {
    makeCount: number | null;
    modelCount: number | null;
  };
  options: {
    makes: Array<{ value: string; count: number | null }>;
    modelsByMake: Record<string, Array<{ value: string; count: number | null }>>;
    locations: Array<{ value: string; label: string }>;
    subLocations: {
      label: string;
      options: Array<{ value: string; label: string }>;
    };
  };
  omitted: string[];
}

export const SEARCH_ACTION = 'https://www.mobile.bg/pcgi/mobile.cgi';
const SEARCH_PAGE_URL = 'https://www.mobile.bg/search/avtomobili-dzhipove';
export const HIDDEN_FIELD_NAMES = new Set(['topmenu', 'rub', 'act', 'rub_pub_save', 'pubtype', 'f20', 'f9']);
export const ALWAYS_INCLUDED_FIELD_NAMES = new Set(['f17']);

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

const LOCATION_OPTIONS: LabeledOption[] = [
  { value: '', label: 'всички' },
  { value: 'България', label: 'България' },
  { value: 'Извън страната', label: 'Извън страната' },
  { value: 'Благоевград', label: 'обл. Благоевград' },
  { value: 'Бургас', label: 'обл. Бургас' },
  { value: 'Варна', label: 'обл. Варна' },
  { value: 'Велико Търново', label: 'обл. Велико Търново' },
  { value: 'Видин', label: 'обл. Видин' },
  { value: 'Враца', label: 'обл. Враца' },
  { value: 'Габрово', label: 'обл. Габрово' },
  { value: 'Добрич', label: 'обл. Добрич' },
  { value: 'Дупница', label: 'общ. Дупница' },
  { value: 'Кърджали', label: 'обл. Кърджали' },
  { value: 'Кюстендил', label: 'обл. Кюстендил' },
  { value: 'Ловеч', label: 'обл. Ловеч' },
  { value: 'Монтана', label: 'обл. Монтана' },
  { value: 'Пазарджик', label: 'обл. Пазарджик' },
  { value: 'Перник', label: 'обл. Перник' },
  { value: 'Плевен', label: 'обл. Плевен' },
  { value: 'Пловдив', label: 'обл. Пловдив' },
  { value: 'Разград', label: 'обл. Разград' },
  { value: 'Русе', label: 'обл. Русе' },
  { value: 'Силистра', label: 'обл. Силистра' },
  { value: 'Сливен', label: 'обл. Сливен' },
  { value: 'Смолян', label: 'обл. Смолян' },
  { value: 'София', label: 'обл. София' },
  { value: 'Стара Загора', label: 'обл. Стара Загора' },
  { value: 'Търговище', label: 'обл. Търговище' },
  { value: 'Хасково', label: 'обл. Хасково' },
  { value: 'Шумен', label: 'обл. Шумен' },
  { value: 'Ямбол', label: 'обл. Ямбол' },
];

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

function encodeSearchParamWin1251(value: string) {
  const bytes = iconv.encode(value, 'windows-1251');
  let result = '';
  for (const byte of bytes) {
    const isAlphaNum =
      (byte >= 0x30 && byte <= 0x39) ||
      (byte >= 0x41 && byte <= 0x5a) ||
      (byte >= 0x61 && byte <= 0x7a);
    const isSafe = byte === 0x2d || byte === 0x2e || byte === 0x5f || byte === 0x7e;
    if (isAlphaNum || isSafe) {
      result += String.fromCharCode(byte);
    } else {
      result += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
    }
  }
  return result;
}

async function fetchSubLocationOptions(location: string) {
  const url = location
    ? `${SEARCH_PAGE_URL}?sort=3&f17=${encodeSearchParamWin1251(location)}`
    : `${SEARCH_PAGE_URL}?sort=3`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Failed to load location options: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const html = iconv.decode(buffer, 'windows-1251');
  const $ = load(html);
  const label = $('select[name="f18"]').closest('item').find('title').first().text().trim() || 'Населено място';
  const options = $('select[name="f18"] option').toArray().map((option) => ({
    value: ($(option).attr('value') || '').trim(),
    label: $(option).text().trim() || 'всички',
  }));

  return {
    label,
    options: options.length > 0 ? options : [{ value: '', label: 'всички' }],
  };
}

export async function getListingSearchPrefill(
  listingId: number,
  options: { includeLocationOptions?: boolean } = {},
): Promise<SearchPrefillData | null> {
  const { includeLocationOptions = true } = options;
  const listing = raw.prepare(`
    SELECT
      id,
      mobile_id,
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

  if (!listing) return null;

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

  const subLocations = includeLocationOptions
    ? await fetchSubLocationOptions('България')
    : { label: 'Населено място', options: [{ value: '', label: 'всички' }] };

  const fields: SearchField[] = [
    { name: 'topmenu', label: 'Top menu', value: '1', source: 'default' },
    { name: 'rub', label: 'Rubric', value: '1', source: 'default' },
    { name: 'act', label: 'Action', value: '3', source: 'default' },
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

  visibleFields.push({
    name: 'f17',
    label: 'Намира се в',
    value: 'България',
    source: 'default',
  });
  visibleFields.push({
    name: 'f18',
    label: subLocations.label,
    value: '',
    source: 'default',
  });

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

  return {
    listing: {
      id: listing.id,
      mobile_id: listing.mobile_id,
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
      locations: LOCATION_OPTIONS,
      subLocations,
    },
    omitted,
  };
}

export function buildFirstSevenSearchFields(fields: SearchField[]) {
  const hiddenFields = fields.filter((field) => HIDDEN_FIELD_NAMES.has(field.name));
  const alwaysIncludedFields = fields.filter((field) => ALWAYS_INCLUDED_FIELD_NAMES.has(field.name));
  const firstSevenVisibleFields = fields
    .filter((field) => !HIDDEN_FIELD_NAMES.has(field.name) && !ALWAYS_INCLUDED_FIELD_NAMES.has(field.name))
    .slice(0, 7);
  return [...hiddenFields, ...alwaysIncludedFields, ...firstSevenVisibleFields];
}
