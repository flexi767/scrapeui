import { SEARCH_ACTION, type SearchField } from "@/lib/mobile-bg/search-form-shared";

export function mergeEditableFields(
  originalFields: SearchField[],
  editableFields: SearchField[],
) {
  return originalFields.map((field) => {
    const edited = editableFields.find(
      (candidate) => candidate.name === field.name,
    );
    return edited ?? field;
  });
}

export function didMakeOrModelChange(
  originalFields: SearchField[],
  currentFields: SearchField[],
) {
  const originalMap = new Map(
    originalFields.map((field) => [field.name, field.value]),
  );
  const currentMap = new Map(
    currentFields.map((field) => [field.name, field.value]),
  );
  return (
    (currentMap.get("marka") ?? "") !== (originalMap.get("marka") ?? "") ||
    (currentMap.get("model") ?? "") !== (originalMap.get("model") ?? "")
  );
}

export function submitMobileBgSearch(fields: SearchField[]) {
  if (typeof document === "undefined") return;
  const form = document.createElement("form");
  form.method = "POST";
  form.action = SEARCH_ACTION;
  form.target = "_blank";
  form.acceptCharset = "windows-1251";

  for (const field of fields) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = field.name;
    input.value = field.value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
  form.remove();
}
