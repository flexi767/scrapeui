import type { SearchField } from './types';
import {
  MOBILE_BG_ALWAYS_INCLUDED_FIELD_NAMES as ALWAYS_INCLUDED_FIELD_NAMES,
  MOBILE_BG_HIDDEN_FIELD_NAMES as HIDDEN_FIELD_NAMES,
} from '@/lib/mobile-bg/search-field-config';

export function mergeEditableFields(baseFields: SearchField[], editedFields: SearchField[]) {
  return baseFields.map((field) => {
    const edited = editedFields.find((candidate) => candidate.name === field.name);
    return edited ?? field;
  });
}

export function takeFirstVisibleFields(fields: SearchField[], limit: number) {
  const hiddenFields = fields.filter((field) => HIDDEN_FIELD_NAMES.has(field.name));
  const alwaysIncludedFields = fields.filter((field) => ALWAYS_INCLUDED_FIELD_NAMES.has(field.name));
  const visibleFields = fields
    .filter((field) => !HIDDEN_FIELD_NAMES.has(field.name) && !ALWAYS_INCLUDED_FIELD_NAMES.has(field.name))
    .slice(0, limit);

  return [...hiddenFields, ...alwaysIncludedFields, ...visibleFields];
}
