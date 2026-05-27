import { raw } from "@/db/client";
import { getSavedSearchProfile } from "@/lib/mobile-bg/search-profiles";
import {
  HIDDEN_FIELD_NAMES,
  SEARCH_ACTION,
  type SearchField,
} from "@/lib/mobile-bg/search-form-shared";
import {
  LOCATION_OPTIONS,
  loadMakeModelOptions,
  loadSubLocationOptions,
} from "@/lib/mobile-bg/search-prefill-options";
import {
  buildListingSearchFields,
  mapListingSearchRow,
  type ListingSearchRow,
} from "@/lib/mobile-bg/search-prefill-fields";

interface ReferenceRow {
  make_count: number | null;
  model_count: number | null;
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
  const builtFields = buildListingSearchFields(
    listing,
    savedFieldMap,
    subLocations.label,
  );

  return {
    listing: mapListingSearchRow(listing),
    form: {
      action: SEARCH_ACTION,
      method: "POST",
      fields: builtFields.fields,
      visibleFields: builtFields.visibleFields,
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
    omitted: builtFields.omitted,
    savedSearch: {
      enabled: effectiveSavedFields.length > 0,
      updatedAt: overrideFields ? null : (savedProfile?.updatedAt ?? null),
    },
  };
}
