export const MOBILE_BG_HIDDEN_FIELD_NAMES = new Set([
  "topmenu",
  "rub",
  "act",
  "rub_pub_save",
  "pubtype",
  "f20",
  "f9",
]);

export const MOBILE_BG_ALWAYS_INCLUDED_FIELD_NAMES = new Set(["f17"]);

export const MOBILE_BG_ENGINE_OPTIONS = [
  "",
  "Бензинов",
  "Дизелов",
  "Електрически",
  "Хибриден",
  "Plug-in хибрид",
  "Газ",
  "Водород",
];

export const MOBILE_BG_TRANSMISSION_OPTIONS = [
  "",
  "Ръчна",
  "Автоматична",
  "Полуавтоматична",
];

export const MOBILE_BG_CATEGORY_OPTIONS = [
  "",
  "Ван",
  "Джип",
  "Кабрио",
  "Комби",
  "Купе",
  "Миниван",
  "Пикап",
  "Седан",
  "Стреч лимузина",
  "Хечбек",
];

export const MOBILE_BG_STEPPER_FIELDS = new Set(["f10", "f11", "f25", "f26"]);
export const MOBILE_BG_CLEARABLE_FIELDS = new Set(["f25", "f26", "f7", "f8", "f15"]);

export const MOBILE_BG_HEADER_STEPPER_FIELDS: Record<string, number> = {
  f10: 1,
  f11: 1,
  f25: 10,
  f26: 10,
};

export const MOBILE_BG_PAIRED_FIELD_END_NAMES = new Set([
  "f11",
  "f26",
  "f8",
  "f13",
  "f18",
  "f15",
]);

export const MOBILE_BG_PAIRED_FIELD_NAMES: Record<string, string> = {
  f10: "f11",
  f25: "f26",
  f7: "f8",
  f12: "f13",
  f17: "f18",
  f14: "f15",
};

export const MOBILE_BG_HIDDEN_FIELD_CODE_NAMES = new Set(["f13", "f15", "f18"]);

export const MOBILE_BG_FIELD_LAYOUT_CLASS: Record<string, string> = {
  marka: "md:col-span-1 xl:col-span-2",
  model: "md:col-span-1 xl:col-span-2",
  f10: "md:col-span-2 xl:col-span-2",
  f25: "md:col-span-2 xl:col-span-2",
  f7: "md:col-span-2 xl:col-span-2",
  f12: "md:col-span-2 xl:col-span-2",
  f17: "md:col-span-2 xl:col-span-2",
  f14: "md:col-span-2 xl:col-span-2",
};
