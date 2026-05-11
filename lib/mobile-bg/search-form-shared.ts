export interface SearchField {
  name: string;
  label: string;
  value: string;
  source: "default" | "listing" | "derived" | "saved";
}

export function parseSearchFields(payload: unknown): SearchField[] | null {
  if (!Array.isArray(payload)) return null;
  const fields: SearchField[] = [];
  for (const entry of payload) {
    if (!entry || typeof entry !== 'object') return null;
    const c = entry as Record<string, unknown>;
    if (typeof c.name !== 'string' || typeof c.label !== 'string' || typeof c.value !== 'string') return null;
    fields.push({
      name: c.name,
      label: c.label,
      value: c.value,
      source: c.source === 'default' || c.source === 'listing' || c.source === 'derived' || c.source === 'saved'
        ? c.source
        : 'saved',
    });
  }
  return fields;
}

export const SEARCH_ACTION = "https://www.mobile.bg/pcgi/mobile.cgi";
export const HIDDEN_FIELD_NAMES = MOBILE_BG_HIDDEN_FIELD_NAMES;
export const ALWAYS_INCLUDED_FIELD_NAMES = MOBILE_BG_ALWAYS_INCLUDED_FIELD_NAMES;

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
