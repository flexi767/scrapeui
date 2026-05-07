import type { SearchField } from "@/lib/mobile-bg/search-form-shared";
import { MOBILE_BG_FIELD_LAYOUT_CLASS } from "@/lib/mobile-bg/search-field-config";

export function getSavedSearchFieldLayoutClass(name: string) {
  return MOBILE_BG_FIELD_LAYOUT_CLASS[name] ?? "";
}

export function getSavedSearchFieldLabel(
  field: SearchField,
  subLocationLabel: string,
) {
  if (field.name === "f18") return subLocationLabel;
  if (field.name === "f25" || field.name === "f26") {
    return field.label.replace(/\s*\[к\.с\.\]\s*/g, "");
  }
  return field.label;
}

export function orderSavedSearchFieldsForDisplay(fields: SearchField[]) {
  const fieldsByName = new Map(fields.map((field) => [field.name, field]));
  const priorityNames = ["f14", "f15", "f17", "f18", "f10", "f11"];
  const priorityFields = priorityNames
    .map((name) => fieldsByName.get(name))
    .filter((field): field is SearchField => field != null);
  if (priorityFields.length === 0) return fields;

  const orderedFields = fields.filter(
    (field) => !priorityNames.includes(field.name),
  );
  const modelIndex = orderedFields.findIndex((field) => field.name === "model");
  if (modelIndex === -1) return fields;

  const [categoryFrom, mileageTo, locationFrom, locationTo, yearFrom, yearTo] =
    priorityFields;
  orderedFields.splice(
    modelIndex + 1,
    0,
    ...[categoryFrom, mileageTo, locationFrom, locationTo].filter(
      (field): field is SearchField => field != null,
    ),
  );

  const engineIndex = orderedFields.findIndex((field) => field.name === "f12");
  const yearFields = [yearFrom, yearTo].filter(
    (field): field is SearchField => field != null,
  );
  if (engineIndex !== -1) {
    orderedFields.splice(engineIndex + 1, 0, ...yearFields);
    return orderedFields;
  }

  orderedFields.push(...yearFields);
  return orderedFields;
}
