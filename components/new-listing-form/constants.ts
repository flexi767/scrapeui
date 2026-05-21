export { EXTRA_SECTIONS } from "@/lib/mobile-bg/extras";

export const MAIN_CATEGORIES = [
  { value: "1,2", label: "Автомобили и джипове" },
  { value: "3", label: "Бусове / Микробуси" },
  { value: "4", label: "Товарни автомобили" },
  { value: "7", label: "Мотоциклети / Мотопеди" },
  { value: "9", label: "Водни МПС" },
  { value: "11", label: "Ремаркета" },
  { value: "12", label: "Специална техника" },
];

export const CONDITION_OPTIONS = [
  { value: "1", label: "Нов", disabled: true },
  { value: "0", label: "Употребяван" },
  { value: "3", label: "Повреден/ударен" },
  { value: "2", label: "За части" },
];

export const EURO_OPTIONS = [
  "",
  "Евро 1",
  "Евро 2",
  "Евро 3",
  "Евро 4",
  "Евро 5",
  "Евро 6",
];
export const CURRENCY_OPTIONS = ["EUR", "USD"];
export const IMAGE_UPLOAD_BATCH_SIZE = 5;
export const MONTH_OPTIONS = [
  "",
  "януари",
  "февруари",
  "март",
  "април",
  "май",
  "юни",
  "юли",
  "август",
  "септември",
  "октомври",
  "ноември",
  "декември",
];
const CURRENT_YEAR = new Date().getFullYear();

export const PRODUCTION_YEAR_OPTIONS = [
  "",
  ...Array.from({ length: CURRENT_YEAR - 1929 }, (_, index) =>
    String(CURRENT_YEAR - index),
  ),
];
export const BODY_TYPE_OPTIONS = [
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
export const COLOR_OPTIONS = [
  "",
  "Tъмно син",
  "Банан",
  "Беата",
  "Бежов",
  "Бордо",
  "Бронз",
  "Бял",
  "Винен",
  "Виолетов",
  "Вишнев",
  "Графит",
  "Жълт",
  "Зелен",
  "Златист",
  "Кафяв",
  "Керемиден",
  "Кремав",
  "Лилав",
  "Металик",
  "Оранжев",
  "Охра",
  "Пепеляв",
  "Перла",
  "Пясъчен",
  "Резидав",
  "Розов",
  "Сахара",
  "Светло сив",
  "Светло син",
  "Сив",
  "Син",
  "Слонова кост",
  "Сребърен",
  "Т.зелен",
  "Тъмно сив",
  "Тъмно син мет.",
  "Тъмно червен",
  "Тютюн",
  "Хамелеон",
  "Червен",
  "Черен",
];


export const BATTERY_FUELS = new Set([
  "Електрически",
  "Хибриден",
  "Plug-in хибрид",
  "Водород",
]);

export type FormState = {
  dealerId: string;
  pubtype: string;
  make: string;
  model: string;
  title: string;
  fuel: string;
  condition: string;
  power: string;
  euronorm: string;
  transmission: string;
  bodyType: string;
  engineCc: string;
  batteryRange: string;
  batteryCapacity: string;
  price: string;
  vat: string;
  currency: string;
  mileage: string;
  productionMonth: string;
  productionYear: string;
  color: string;
  region: string;
  city: string;
  vin: string;
  description: string;
  phone: string;
  email: string;
  website: string;
  priceOnRequest: boolean;
  extras: Record<string, string[]>;
};

export const EMPTY: FormState = {
  dealerId: "",
  pubtype: "1,2",
  make: "",
  model: "",
  title: "",
  fuel: "",
  condition: "0",
  power: "",
  euronorm: "",
  transmission: "",
  bodyType: "",
  engineCc: "",
  batteryRange: "",
  batteryCapacity: "",
  price: "",
  vat: "",
  currency: "EUR",
  mileage: "",
  productionMonth: "",
  productionYear: "",
  color: "",
  region: "",
  city: "",
  vin: "",
  description: "",
  phone: "",
  email: "",
  website: "",
  priceOnRequest: false,
  extras: {},
};

export interface PrefillResponse {
  form: FormState;
}

export interface BackupImage {
  id: number;
  backupId: number;
  sortOrder: number;
  filename: string;
  url: string;
  createdAt: string | null;
}
