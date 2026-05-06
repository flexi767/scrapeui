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

export function submitMobileBgSearch(
  fields: SearchField[],
  target = "_blank",
  targetWindowName?: string,
) {
  if (typeof document === "undefined") return;
  const formTarget = targetWindowName || target;
  if (target && target !== "_self") {
    window.open("", formTarget);
  }

  const form = document.createElement("form");
  form.method = "POST";
  form.action = SEARCH_ACTION;
  form.target = formTarget;
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

export function normalizeLocationOptions(payload: {
  label?: unknown;
  options?: unknown;
}) {
  const label =
    typeof payload.label === "string" && payload.label
      ? payload.label
      : "Населено място";
  const options =
    Array.isArray(payload.options) && payload.options.length > 0
      ? (payload.options as Array<{ value: string; label: string }>)
      : [{ value: "", label: "всички" }];

  return { label, options };
}
