import { raw } from "@/db/client";
import {
  DEFAULT_SUB_LOCATION_OPTIONS,
  fetchSubLocationOptions,
  type SubLocationOptions,
} from "@/lib/mobile-bg/location-options";
import { getSavedSearchProfile } from "@/lib/mobile-bg/search-profiles";
import {
  MOBILE_BG_FUEL_SET,
  MOBILE_BG_TRANSMISSION_SET,
  MOBILE_BG_CATEGORY_SET,
} from "@/lib/mobile-bg/search-field-config";
import {
  HIDDEN_FIELD_NAMES,
  SEARCH_ACTION,
  type SearchField,
} from "@/lib/mobile-bg/search-form-shared";

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
  thumb_keys: string | null;
  full_keys: string | null;
  image_meta: string | null;
  images_downloaded: number | null;
  thumb_saved: number | null;
}

interface ReferenceRow {
  make_count: number | null;
  model_count: number | null;
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
    thumbKeys: string | null;
    fullKeys: string | null;
    imageMeta: string | null;
    imagesDownloaded: number | null;
    thumbSaved: number | null;
  } | null;
  form: {
    action: string;
    method: "POST";
    fields: SearchField[];
    visibleFields: SearchField[];
  };
  reference: {
    makeCount: number | null;
    modelCount: number | null;
  };
  options: {
    makes: Array<{ value: string; count: number | null }>;
    modelsByMake: Record<
      string,
      Array<{ value: string; count: number | null }>
    >;
    locations: Array<{ value: string; label: string }>;
    subLocations: {
      label: string;
      options: Array<{ value: string; label: string }>;
    };
  };
  omitted: string[];
  savedSearch: {
    enabled: boolean;
    updatedAt: string | null;
  };
}


const LOCATION_OPTIONS: LabeledOption[] = [
  { value: "", label: "всички" },
  { value: "България", label: "България" },
  { value: "Извън страната", label: "Извън страната" },
  { value: "Благоевград", label: "обл. Благоевград" },
  { value: "Бургас", label: "обл. Бургас" },
  { value: "Варна", label: "обл. Варна" },
  { value: "Велико Търново", label: "обл. Велико Търново" },
  { value: "Видин", label: "обл. Видин" },
  { value: "Враца", label: "обл. Враца" },
  { value: "Габрово", label: "обл. Габрово" },
  { value: "Добрич", label: "обл. Добрич" },
  { value: "Дупница", label: "общ. Дупница" },
  { value: "Кърджали", label: "обл. Кърджали" },
  { value: "Кюстендил", label: "обл. Кюстендил" },
  { value: "Ловеч", label: "обл. Ловеч" },
  { value: "Монтана", label: "обл. Монтана" },
  { value: "Пазарджик", label: "обл. Пазарджик" },
  { value: "Перник", label: "обл. Перник" },
  { value: "Плевен", label: "обл. Плевен" },
  { value: "Пловдив", label: "обл. Пловдив" },
  { value: "Разград", label: "обл. Разград" },
  { value: "Русе", label: "обл. Русе" },
  { value: "Силистра", label: "обл. Силистра" },
  { value: "Сливен", label: "обл. Сливен" },
  { value: "Смолян", label: "обл. Смолян" },
  { value: "София", label: "обл. София" },
  { value: "Стара Загора", label: "обл. Стара Загора" },
  { value: "Търговище", label: "обл. Търговище" },
  { value: "Хасково", label: "обл. Хасково" },
  { value: "Шумен", label: "обл. Шумен" },
  { value: "Ямбол", label: "обл. Ямбол" },
];

async function loadSubLocationOptions(
  location: string,
  includeLocationOptions: boolean,
): Promise<SubLocationOptions> {
  if (!includeLocationOptions) return DEFAULT_SUB_LOCATION_OPTIONS;

  try {
    return await fetchSubLocationOptions(location);
  } catch (error) {
    console.warn(
      `Falling back to default sub-location options for "${location}":`,
      error,
    );
    return DEFAULT_SUB_LOCATION_OPTIONS;
  }
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
  return ">300000";
}

function addField(
  fields: SearchField[],
  name: string,
  label: string,
  value: string | null | undefined,
  source: SearchField["source"],
) {
  if (!value) return;
  fields.push({ name, label, value, source });
}


async function loadMakeModelOptions() {
  const makeOptions = raw
    .prepare(
      `
    SELECT make as value, make_count as count
    FROM mobilebg_make_models
    WHERE model = ''
    ORDER BY make
  `,
    )
    .all() as ReferenceOption[];

  const modelRows = raw
    .prepare(
      `
    SELECT make, model as value, model_count as count
    FROM mobilebg_make_models
    WHERE model != ''
    ORDER BY make, model
  `,
    )
    .all() as Array<ReferenceOption & { make: string }>;

  const modelsByMake = modelRows.reduce<Record<string, ReferenceOption[]>>(
    (acc, row) => {
      if (!acc[row.make]) acc[row.make] = [];
      acc[row.make].push({ value: row.value, count: row.count });
      return acc;
    },
    {},
  );

  return { makeOptions, modelsByMake };
}

export async function getListingSearchPrefill(
  listingId: number | null,
  options: {
    includeLocationOptions?: boolean;
    overrideFields?: SearchField[] | null;
    useSavedProfile?: boolean;
  } = {},
): Promise<SearchPrefillData | null> {
  const {
    includeLocationOptions = true,
    overrideFields = null,
    useSavedProfile = true,
  } = options;

  const { makeOptions, modelsByMake } = await loadMakeModelOptions();

  if (listingId == null) {
    const effectiveSavedFields = overrideFields ?? [];
    const savedFieldMap = new Map(
      effectiveSavedFields.map((field) => [field.name, field]),
    );
    const savedMake = savedFieldMap.get("marka")?.value.trim() ?? "";
    const savedModel = savedFieldMap.get("model")?.value.trim() ?? "";
    const savedMakeCount =
      makeOptions.find((option) => option.value === savedMake)?.count ?? null;
    const savedModelCount =
      (modelsByMake[savedMake] ?? []).find(
        (option) => option.value === savedModel,
      )?.count ?? null;
    const preferredLocation = savedFieldMap.get("f17")?.value || "България";
    const subLocations = await loadSubLocationOptions(
      preferredLocation,
      includeLocationOptions,
    );

    return {
      listing: null,
      form: {
        action: SEARCH_ACTION,
        method: "POST",
        fields: effectiveSavedFields,
        visibleFields: effectiveSavedFields.filter(
          (field) => !HIDDEN_FIELD_NAMES.has(field.name),
        ),
      },
      reference: {
        makeCount: savedMakeCount,
        modelCount: savedModelCount,
      },
      options: {
        makes: makeOptions,
        modelsByMake,
        locations: LOCATION_OPTIONS,
        subLocations,
      },
      omitted: [],
      savedSearch: {
        enabled: effectiveSavedFields.length > 0,
        updatedAt: null,
      },
    };
  }

  const listing = raw
    .prepare(
      `
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
      current_price,
      thumb_keys,
      full_keys,
      image_meta,
      images_downloaded,
      thumb_saved
    FROM listings
    WHERE id = ?
    LIMIT 1
  `,
    )
    .get(listingId) as ListingSearchRow | undefined;

  if (!listing) return null;

  const makeReference = raw
    .prepare(
      `
    SELECT make_count, model_count
    FROM mobilebg_make_models
    WHERE make = ? AND model = ''
    LIMIT 1
  `,
    )
    .get(listing.make ?? "") as ReferenceRow | undefined;

  const modelReference = raw
    .prepare(
      `
    SELECT make_count, model_count
    FROM mobilebg_make_models
    WHERE make = ? AND model = ?
    LIMIT 1
  `,
    )
    .get(listing.make ?? "", listing.model ?? "") as ReferenceRow | undefined;

  const savedProfile = useSavedProfile
    ? getSavedSearchProfile(listing.id)
    : null;
  const effectiveSavedFields = overrideFields ?? savedProfile?.fields ?? [];
  const savedFieldMap = new Map(
    effectiveSavedFields.map((field) => [field.name, field]),
  );
  const preferredLocation = savedFieldMap.get("f17")?.value || "България";

  const subLocations = await loadSubLocationOptions(
    preferredLocation,
    includeLocationOptions,
  );

  const fields: SearchField[] = [
    { name: "topmenu", label: "Top menu", value: "1", source: "default" },
    { name: "rub", label: "Rubric", value: "1", source: "default" },
    { name: "act", label: "Action", value: "3", source: "default" },
    {
      name: "rub_pub_save",
      label: "Saved rubric",
      value: "1",
      source: "default",
    },
    { name: "pubtype", label: "Category", value: "1", source: "default" },
    { name: "f20", label: "Сортиране според", value: "3", source: "default" },
  ];
  const visibleFields: SearchField[] = [];
  const omitted: string[] = [];

  addField(visibleFields, "marka", "Марка", listing.make, "listing");
  addField(visibleFields, "model", "Модел", listing.model, "listing");

  if (listing.reg_year && /^\d{4}$/.test(listing.reg_year)) {
    const year = Number.parseInt(listing.reg_year, 10);
    addField(visibleFields, "f10", "Година от", String(year - 1), "derived");
    addField(visibleFields, "f11", "Година до", String(year + 1), "derived");
  } else {
    omitted.push("Year was missing or invalid.");
  }

  visibleFields.push({
    name: "f12",
    label: "Двигател",
    value: listing.fuel && MOBILE_BG_FUEL_SET.has(listing.fuel) ? listing.fuel : "",
    source:
      listing.fuel && MOBILE_BG_FUEL_SET.has(listing.fuel) ? "listing" : "default",
  });
  if (listing.fuel && !MOBILE_BG_FUEL_SET.has(listing.fuel)) {
    omitted.push(
      `Fuel "${listing.fuel}" does not match a known mobile.bg search option.`,
    );
  }

  visibleFields.push({
    name: "f13",
    label: "Скоростна кутия",
    value:
      listing.transmission && MOBILE_BG_TRANSMISSION_SET.has(listing.transmission)
        ? listing.transmission
        : "",
    source:
      listing.transmission && MOBILE_BG_TRANSMISSION_SET.has(listing.transmission)
        ? "listing"
        : "default",
  });
  if (
    listing.transmission &&
    !MOBILE_BG_TRANSMISSION_SET.has(listing.transmission)
  ) {
    omitted.push(
      `Transmission "${listing.transmission}" does not match a known mobile.bg search option.`,
    );
  }

  visibleFields.push({
    name: "f14",
    label: "Категория",
    value:
      listing.body_type && MOBILE_BG_CATEGORY_SET.has(listing.body_type)
        ? listing.body_type
        : "",
    source:
      listing.body_type && MOBILE_BG_CATEGORY_SET.has(listing.body_type)
        ? "listing"
        : "default",
  });
  if (listing.body_type && !MOBILE_BG_CATEGORY_SET.has(listing.body_type)) {
    omitted.push(
      `Body type "${listing.body_type}" does not match a supported mobile.bg category.`,
    );
  }

  visibleFields.push({
    name: "f17",
    label: "Намира се в",
    value: "България",
    source: "default",
  });
  visibleFields.push({
    name: "f18",
    label: subLocations.label,
    value: "",
    source: "default",
  });

  if (listing.power != null && listing.power > 0) {
    addField(
      visibleFields,
      "f25",
      "Мощност от [к.с.]",
      String(Math.max(0, listing.power - 5)),
      "derived",
    );
    addField(
      visibleFields,
      "f26",
      "Мощност до [к.с.]",
      String(listing.power + 5),
      "derived",
    );
  }

  if (listing.current_price != null && listing.current_price > 0) {
    addField(
      visibleFields,
      "f7",
      "Цена от",
      String(Math.max(0, Math.floor(listing.current_price * 0.9))),
      "derived",
    );
    addField(
      visibleFields,
      "f8",
      "Цена до",
      String(Math.ceil(listing.current_price * 1.1)),
      "derived",
    );
    addField(visibleFields, "f9", "Валута", "EUR", "default");
  }

  const mileageBucket = toMileageBucket(listing.mileage);
  if (mileageBucket) {
    addField(visibleFields, "f15", "Макс. пробег", mileageBucket, "derived");
  } else if (listing.mileage != null) {
    omitted.push("Mileage was outside the supported mobile.bg buckets.");
  }

  const applySavedOverrides = (fieldList: SearchField[]) =>
    fieldList.map((field) => {
      const saved = savedFieldMap.get(field.name);
      if (!saved) return field;
      return {
        ...field,
        value: saved.value,
        source: "saved" as const,
      };
    });

  const savedVisibleFields = applySavedOverrides(visibleFields);
  fields.push(...savedVisibleFields);

  const finalFields = applySavedOverrides(fields);
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
      thumbKeys: listing.thumb_keys,
      fullKeys: listing.full_keys,
      imageMeta: listing.image_meta,
      imagesDownloaded: listing.images_downloaded,
      thumbSaved: listing.thumb_saved,
    },
    form: {
      action: SEARCH_ACTION,
      method: "POST",
      fields: finalFields,
      visibleFields: savedVisibleFields,
    },
    reference: {
      makeCount:
        modelReference?.make_count ?? makeReference?.make_count ?? null,
      modelCount: modelReference?.model_count ?? null,
    },
    options: {
      makes: makeOptions,
      modelsByMake,
      locations: LOCATION_OPTIONS,
      subLocations,
    },
    omitted,
    savedSearch: {
      enabled: effectiveSavedFields.length > 0,
      updatedAt: overrideFields ? null : (savedProfile?.updatedAt ?? null),
    },
  };
}
