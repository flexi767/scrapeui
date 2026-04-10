export interface SearchField {
  name: string;
  label: string;
  value: string;
  source: 'default' | 'listing' | 'derived' | 'saved';
}

export const SEARCH_ACTION = 'https://www.mobile.bg/pcgi/mobile.cgi';
export const HIDDEN_FIELD_NAMES = new Set(['topmenu', 'rub', 'act', 'rub_pub_save', 'pubtype', 'f20', 'f9']);
export const ALWAYS_INCLUDED_FIELD_NAMES = new Set(['f17']);

export function buildFirstSevenSearchFields(fields: SearchField[]) {
  const hiddenFields = fields.filter((field) => HIDDEN_FIELD_NAMES.has(field.name));
  const alwaysIncludedFields = fields.filter((field) => ALWAYS_INCLUDED_FIELD_NAMES.has(field.name));
  const firstSevenVisibleFields = fields
    .filter((field) => !HIDDEN_FIELD_NAMES.has(field.name) && !ALWAYS_INCLUDED_FIELD_NAMES.has(field.name))
    .slice(0, 7);
  return [...hiddenFields, ...alwaysIncludedFields, ...firstSevenVisibleFields];
}
