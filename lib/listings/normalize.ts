import { getBodyTypeMap, normalizeBodyTypeSync } from '@/lib/mobile-bg/body-types';
import { normalizeFuelSync } from '@/lib/mobile-bg/fuel-types';
import { parseMakeModelSync, type MakesMap } from '@/lib/mobile-bg/makes-models';
import { normalizeTransmissionSync } from '@/lib/mobile-bg/transmission-types';

export interface ListingSpecMaps {
  makesMap: MakesMap | null;
  fuelMap: Map<string, string> | null;
  transmissionMap: Map<string, string> | null;
}

export interface RawListingSpecs {
  fuel: string | null;
  bodyType: string | null;
  transmission: string | null;
}

/**
 * Shared make/model/title + fuel/body/transmission normalization used by both
 * the mobile.bg and cars.bg listing-persistence upserts.
 *
 * Callers that need source-specific pre-normalization (e.g. cars.bg's
 * `normCarsBg*` mappers) should apply it to the `raw` values before passing
 * them in — this helper only runs the shared mobile.bg normalizers.
 */
export function normalizeListingSpecs(
  rawTitle: string,
  raw: RawListingSpecs,
  maps: ListingSpecMaps,
) {
  const { make, model, mobileMakeId, mobileModelId, titleRemainder } =
    parseMakeModelSync(rawTitle, maps.makesMap);
  return {
    make,
    model,
    mobileMakeId,
    mobileModelId,
    normalizedTitle: (titleRemainder || rawTitle).trim(),
    fuel: normalizeFuelSync(raw.fuel, maps.fuelMap),
    bodyType: normalizeBodyTypeSync(raw.bodyType, getBodyTypeMap()),
    transmission: normalizeTransmissionSync(raw.transmission, maps.transmissionMap),
  };
}
