import {
  MOBILE_BG_CATEGORY_SET,
  MOBILE_BG_FUEL_SET,
  MOBILE_BG_TRANSMISSION_SET,
} from '@/lib/mobile-bg/search-field-config';
import type { SearchField } from '@/lib/mobile-bg/search-form-shared';

export interface ListingSearchRow {
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
  thumb_keys: string | null;
  full_keys: string | null;
  image_meta: string | null;
  images_downloaded: number | null;
  thumb_saved: number | null;
}

function toMileageBucket(value: number | null): string | null {
  if (!value || value <= 0) return null;
  const limits = [
    10000, 20000, 30000, 40000, 50000, 60000, 70000, 80000, 90000, 100000,
    110000, 120000, 130000, 140000, 150000, 200000, 250000, 300000,
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

function baseSearchFields(): SearchField[] {
  return [
    { name: 'topmenu', label: 'Top menu', value: '1', source: 'default' },
    { name: 'rub', label: 'Rubric', value: '1', source: 'default' },
    { name: 'act', label: 'Action', value: '3', source: 'default' },
    {
      name: 'rub_pub_save',
      label: 'Saved rubric',
      value: '1',
      source: 'default',
    },
    { name: 'pubtype', label: 'Category', value: '1', source: 'default' },
    { name: 'f20', label: 'Сортиране според', value: '3', source: 'default' },
  ];
}

export function mapListingSearchRow(listing: ListingSearchRow) {
  return {
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
    thumbKeys: listing.thumb_keys,
    fullKeys: listing.full_keys,
    imageMeta: listing.image_meta,
    imagesDownloaded: listing.images_downloaded,
    thumbSaved: listing.thumb_saved,
  };
}

export function buildListingSearchFields(
  listing: ListingSearchRow,
  savedFieldMap: Map<string, SearchField>,
  subLocationLabel: string,
) {
  const fields = baseSearchFields();
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
    value: listing.fuel && MOBILE_BG_FUEL_SET.has(listing.fuel) ? listing.fuel : '',
    source:
      listing.fuel && MOBILE_BG_FUEL_SET.has(listing.fuel) ? 'listing' : 'default',
  });
  if (listing.fuel && !MOBILE_BG_FUEL_SET.has(listing.fuel)) {
    omitted.push(`Fuel "${listing.fuel}" does not match a known mobile.bg search option.`);
  }

  visibleFields.push({
    name: 'f13',
    label: 'Скоростна кутия',
    value:
      listing.transmission && MOBILE_BG_TRANSMISSION_SET.has(listing.transmission)
        ? listing.transmission
        : '',
    source:
      listing.transmission && MOBILE_BG_TRANSMISSION_SET.has(listing.transmission)
        ? 'listing'
        : 'default',
  });
  if (listing.transmission && !MOBILE_BG_TRANSMISSION_SET.has(listing.transmission)) {
    omitted.push(`Transmission "${listing.transmission}" does not match a known mobile.bg search option.`);
  }

  visibleFields.push({
    name: 'f14',
    label: 'Категория',
    value:
      listing.body_type && MOBILE_BG_CATEGORY_SET.has(listing.body_type)
        ? listing.body_type
        : '',
    source:
      listing.body_type && MOBILE_BG_CATEGORY_SET.has(listing.body_type)
        ? 'listing'
        : 'default',
  });
  if (listing.body_type && !MOBILE_BG_CATEGORY_SET.has(listing.body_type)) {
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
    label: subLocationLabel,
    value: '',
    source: 'default',
  });

  if (listing.power != null && listing.power > 0) {
    addField(visibleFields, 'f25', 'Мощност от [к.с.]', String(Math.max(0, listing.power - 5)), 'derived');
    addField(visibleFields, 'f26', 'Мощност до [к.с.]', String(listing.power + 5), 'derived');
  }

  if (listing.current_price != null && listing.current_price > 0) {
    addField(visibleFields, 'f7', 'Цена от', String(Math.max(0, Math.floor(listing.current_price * 0.9))), 'derived');
    addField(visibleFields, 'f8', 'Цена до', String(Math.ceil(listing.current_price * 1.1)), 'derived');
    addField(visibleFields, 'f9', 'Валута', 'EUR', 'default');
  }

  const mileageBucket = toMileageBucket(listing.mileage);
  if (mileageBucket) {
    addField(visibleFields, 'f15', 'Макс. пробег', mileageBucket, 'derived');
  } else if (listing.mileage != null) {
    omitted.push('Mileage was outside the supported mobile.bg buckets.');
  }

  const applySavedOverrides = (fieldList: SearchField[]) =>
    fieldList.map((field) => {
      const saved = savedFieldMap.get(field.name);
      if (!saved) return field;
      return {
        ...field,
        value: saved.value,
        source: 'saved' as const,
      };
    });

  const savedVisibleFields = applySavedOverrides(visibleFields);
  fields.push(...savedVisibleFields);

  return {
    fields: applySavedOverrides(fields),
    visibleFields: savedVisibleFields,
    omitted,
  };
}

