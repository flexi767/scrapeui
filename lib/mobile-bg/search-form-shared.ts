export interface SearchField {
  name: string;
  label: string;
  value: string;
  source: "default" | "listing" | "derived" | "saved";
}

export const SEARCH_ACTION = "https://www.mobile.bg/pcgi/mobile.cgi";
export const HIDDEN_FIELD_NAMES = MOBILE_BG_HIDDEN_FIELD_NAMES;
export const ALWAYS_INCLUDED_FIELD_NAMES = MOBILE_BG_ALWAYS_INCLUDED_FIELD_NAMES;

export function parseSearchFields(payload: unknown): SearchField[] | null {
  if (!Array.isArray(payload)) return null;
  const fields: SearchField[] = [];
  for (const entry of payload) {
    if (!entry || typeof entry !== 'object') return null;
    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.name !== 'string' ||
      typeof candidate.label !== 'string' ||
      typeof candidate.value !== 'string'
    ) {
      return null;
    }
    const src = candidate.source;
    fields.push({
      name: candidate.name,
      label: candidate.label,
      value: candidate.value,
      source:
        src === 'default' || src === 'listing' || src === 'derived' || src === 'saved'
          ? src
          : 'saved',
    });
  }
  return fields;
}

export function buildFirstSevenSearchFields(fields: SearchField[]) {
  const hiddenFields = fields.filter((field) =>
    HIDDEN_FIELD_NAMES.has(field.name),
  );
  const alwaysIncludedFields = fields.filter((field) =>
    ALWAYS_INCLUDED_FIELD_NAMES.has(field.name),
  );
  const firstSevenVisibleFields = fields
    .filter(
      (field) =>
        !HIDDEN_FIELD_NAMES.has(field.name) &&
        !ALWAYS_INCLUDED_FIELD_NAMES.has(field.name),
    )
    .slice(0, 7);
  return [...hiddenFields, ...alwaysIncludedFields, ...firstSevenVisibleFields];
}
import {
  MOBILE_BG_ALWAYS_INCLUDED_FIELD_NAMES,
  MOBILE_BG_HIDDEN_FIELD_NAMES,
} from "@/lib/mobile-bg/search-field-config";
