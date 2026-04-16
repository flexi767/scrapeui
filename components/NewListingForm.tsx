"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import type { MakeEntry } from "@/lib/mobile-bg/makes-models";
import type { Region, City } from "@/lib/mobile-bg/regions";
import { formatPrice } from "@/lib/utils";

interface Dealer {
  id: number;
  slug: string;
  name: string;
}

interface Props {
  makes: MakeEntry[];
  transmissions: string[];
  fuels: string[];
  bodyTypes: string[];
  regions: Region[];
  colors: string[];
  dealers: Dealer[];
  initialDealerListingsByDealer: Record<string, DealerListingSummary[]>;
  initialDealerId?: string;
}

interface AutocompleteOption {
  value: string;
  count?: number | null;
}

interface DealerListingSummary {
  mobileId: string;
  make: string;
  model: string;
  title: string;
  price: number | null;
  thumb: string | null;
}

const MAIN_CATEGORIES = [
  { value: "1,2", label: "Автомобили и джипове" },
  { value: "3", label: "Бусове / Микробуси" },
  { value: "4", label: "Товарни автомобили" },
  { value: "7", label: "Мотоциклети / Мотопеди" },
  { value: "9", label: "Водни МПС" },
  { value: "11", label: "Ремаркета" },
  { value: "12", label: "Специална техника" },
];

const CONDITION_OPTIONS = [
  { value: "1", label: "Нов", disabled: true },
  { value: "0", label: "Употребяван" },
  { value: "3", label: "Повреден/ударен" },
  { value: "2", label: "За части" },
];

const EURO_OPTIONS = [
  "",
  "Евро 1",
  "Евро 2",
  "Евро 3",
  "Евро 4",
  "Евро 5",
  "Евро 6",
];
const CURRENCY_OPTIONS = ["EUR", "USD"];
const MONTH_OPTIONS = [
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
const PRODUCTION_YEAR_OPTIONS = [
  "",
  ...Array.from({ length: new Date().getFullYear() - 1929 }, (_, index) =>
    String(new Date().getFullYear() - index),
  ),
];
const BODY_TYPE_OPTIONS = [
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
const COLOR_OPTIONS = [
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

const EXTRA_SECTIONS = [
  {
    category: "Безопасност",
    items: [
      "GPS система за проследяване",
      "Автоматичен контрол на стабилността",
      "Адаптивни предни светлини",
      "Антиблокираща система",
      "Въздушни възглавници - Задни",
      "Въздушни възглавници - Предни",
      "Въздушни възглавници - Странични",
      "Ел. разпределяне на спирачното усилие",
      "Електронна програма за стабилизиране",
      "Контрол на налягането на гумите",
      "Парктроник",
      "Система ISOFIX",
      "Система за динамична устойчивост",
      "Система за защита от пробуксуване",
      "Система за изсушаване на накладките",
      "Система за контрол на дистанцията",
      "Система за контрол на спускането",
      "Система за подпомагане на спирането",
    ],
  },
  {
    category: "Комфорт",
    items: [
      "Auto Start Stop function",
      "Bluetooth \\ handsfree система",
      "DVD, TV",
      "Steptronic, Tiptronic",
      "USB, audio\\video, IN\\AUX изводи",
      "Адаптивно въздушно окачване",
      "Безключово палене",
      "Блокаж на диференциала",
      "Бордкомпютър",
      "Бързи \\ бавни скорости",
      "Датчик за светлина",
      "Ел. Огледала",
      "Ел. Стъкла",
      "Ел. регулиране на окачването",
      "Ел. регулиране на седалките",
      "Ел. усилвател на волана",
      "Климатик",
      "Климатроник",
      "Мултифункционален волан",
      "Навигация",
      "Отопление на волана",
      "Печка",
      "Подгряване на предното стъкло",
      "Подгряване на седалките",
      "Регулиране на волана",
      "Сензор за дъжд",
      "Серво усилвател на волана",
      "Система за измиване на фаровете",
      "Система за контрол на скоростта (автопилот)",
      "Стерео уредба",
      "Термопомпа",
      "Хладилна жабка",
    ],
  },
  {
    category: "Други",
    items: [
      "4x4",
      "7 места",
      "Buy back",
      "Бартер",
      "Газова уредба",
      "Дълга база",
      "Капариран\\Продаден",
      "Катастрофирал",
      "Къса база",
      "Лизинг",
      "Метанова уредба",
      "На части",
      "Напълно обслужен",
      "Нов внос",
      "С регистрация",
      "Сервизна книжка",
      "Тунинг",
    ],
  },
  {
    category: "Екстериор",
    items: [
      "2(3) Врати",
      "4(5) Врати",
      "LED фарове",
      "Ксенонови фарове",
      "Лети джанти",
      "Металик",
      "Панорамен люк",
      "Рейлинг на покрива",
      "Спойлери",
      "Теглич",
      "Халогенни фарове",
      "Шибедах",
    ],
  },
  {
    category: "Защита",
    items: [
      "OFFROAD пакет",
      "Аларма",
      "Брониран",
      "Каско",
      "Лебедка",
      "Централно заключване",
    ],
  },
  {
    category: "Интериор",
    items: ["Велурен салон", "Десен волан", "Кожен салон"],
  },
  {
    category: "Специализирани",
    items: [
      "TAXI",
      "За хора с увреждания",
      "Катафалка",
      "Линейка",
      "Учебен",
      "Хладилен",
      "Хомологация N1",
    ],
  },
] as const;

const BATTERY_FUELS = new Set([
  "Електрически",
  "Хибриден",
  "Plug-in хибрид",
  "Водород",
]);

type FormState = {
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

const EMPTY: FormState = {
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

interface PrefillResponse {
  form: FormState;
}

function FieldLabel({
  children,
  required = false,
  accent = false,
}: {
  children: React.ReactNode;
  required?: boolean;
  accent?: boolean;
}) {
  return (
    <label
      className={`text-xs font-medium ${accent ? "text-sky-300" : "text-gray-400"} uppercase tracking-wide`}
    >
      {children}
      {required ? <span className="ml-1 text-red-400">*</span> : null}
    </label>
  );
}

function normalizeAutocompleteValue(value: string) {
  return value.trim().toLowerCase();
}

function sortMakeOptions(options: AutocompleteOption[]) {
  return [...options].sort((a, b) => {
    const aHigh = (a.count ?? 0) > 10000 ? 1 : 0;
    const bHigh = (b.count ?? 0) > 10000 ? 1 : 0;
    if (aHigh !== bHigh) return bHigh - aHigh;
    if (aHigh && bHigh && (a.count ?? 0) !== (b.count ?? 0)) {
      return (b.count ?? 0) - (a.count ?? 0);
    }
    return a.value.localeCompare(b.value, "bg");
  });
}

function filterAutocompleteOptions(
  options: AutocompleteOption[],
  query: string,
  {
    hideLowCountOnEmpty = false,
  }: {
    hideLowCountOnEmpty?: boolean;
  } = {},
) {
  const normalizedQuery = normalizeAutocompleteValue(query);
  const visibleBase =
    !normalizedQuery && hideLowCountOnEmpty
      ? options.filter((option) => (option.count ?? 0) >= 5)
      : options;

  if (!normalizedQuery) return visibleBase;
  return visibleBase.filter((option) =>
    normalizeAutocompleteValue(option.value).includes(normalizedQuery),
  );
}

function getSelectedOptionCount(
  options: AutocompleteOption[],
  value: string,
): number | null {
  const normalizedValue = normalizeAutocompleteValue(value);
  if (!normalizedValue) return null;
  const match = options.find(
    (option) => normalizeAutocompleteValue(option.value) === normalizedValue,
  );
  return match?.count ?? null;
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
  accent = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<string | { value: string; label: string; disabled?: boolean }>;
  required?: boolean;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="min-w-0 flex flex-col gap-1">
      <FieldLabel required={required} accent={accent}>
        {label}
      </FieldLabel>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {options.map((option) => {
          if (typeof option === "string") {
            return (
              <option key={`${label}-${option || "empty"}`} value={option}>
                {option || " "}
              </option>
            );
          }
          return (
            <option
              key={`${label}-${option.value}`}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          );
        })}
      </select>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  required = false,
  accent = false,
  type = "text",
  maxLength,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  accent?: boolean;
  type?: string;
  maxLength?: number;
  disabled?: boolean;
}) {
  return (
    <div className="min-w-0 flex flex-col gap-1">
      <FieldLabel required={required} accent={accent}>
        {label}
      </FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        disabled={disabled}
        className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-sky-500 focus:ring-0"
      />
      <span>{label}</span>
    </label>
  );
}

function AutocompleteInput({
  value,
  onChange,
  options,
  placeholder,
  emptyLabel,
  hideLowCountOnEmpty = false,
  open,
  focusWhenOpen = false,
  trailingText,
  onOpenChange,
}: {
  value: string;
  onChange: (value: string) => void;
  options: AutocompleteOption[];
  placeholder?: string;
  emptyLabel: string;
  hideLowCountOnEmpty?: boolean;
  open: boolean;
  focusWhenOpen?: boolean;
  trailingText?: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const shouldSelectAllOnFocusRef = useRef(false);
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open || !focusWhenOpen) return;
    window.requestAnimationFrame(() => {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
    });
  }, [focusWhenOpen, open]);

  const visibleOptions = useMemo(
    () =>
      filterAutocompleteOptions(options, isTyping ? value : "", {
        hideLowCountOnEmpty,
      }),
    [hideLowCountOnEmpty, isTyping, options, value],
  );

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={value}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          if (!open || visibleOptions.length === 0) return;
          event.preventDefault();
          const firstOption = visibleOptions[0];
          onChange(firstOption.value);
          setIsTyping(false);
          onOpenChange(false);
          inputRef.current?.blur();
        }}
        onChange={(event) => {
          onChange(event.target.value);
          setIsTyping(true);
          shouldSelectAllOnFocusRef.current = false;
          onOpenChange(true);
        }}
        onFocus={() => {
          setIsTyping(false);
          shouldSelectAllOnFocusRef.current = true;
          onOpenChange(true);
          window.requestAnimationFrame(() => {
            if (
              shouldSelectAllOnFocusRef.current &&
              inputRef.current &&
              document.activeElement === inputRef.current
            ) {
              inputRef.current.select();
            }
          });
        }}
        onBlur={() => {
          shouldSelectAllOnFocusRef.current = false;
          window.setTimeout(() => {
            if (openRef.current) onOpenChange(false);
          }, 120);
        }}
        placeholder={placeholder}
        className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 pr-14 text-sm text-white focus:border-sky-500 focus:outline-none"
      />
      {trailingText ? (
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
          {trailingText}
        </div>
      ) : null}
      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 max-h-64 overflow-y-auto rounded-md border border-gray-700 bg-gray-900 shadow-xl">
          {visibleOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-500">{emptyLabel}</div>
          ) : (
            visibleOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(option.value);
                  setIsTyping(false);
                  onOpenChange(false);
                  inputRef.current?.blur();
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-800"
              >
                <span>{option.value}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function ExtrasColumn({
  category,
  items,
  selected,
  onToggle,
}: {
  category: string;
  items: readonly string[];
  selected: string[];
  onToggle: (label: string) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-700/60 bg-gray-900/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-white">{category}</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <label
            key={item}
            className="flex cursor-pointer items-start gap-2 text-xs text-gray-300"
          >
            <input
              type="checkbox"
              checked={selected.includes(item)}
              onChange={() => onToggle(item)}
              className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-800 text-sky-500 focus:ring-0"
            />
            <span className="leading-tight">{item}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function DealerSelector({
  dealers,
  value,
  onChange,
}: {
  dealers: Dealer[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {dealers.map((dealer) => {
        const selected = value === String(dealer.id);
        return (
          <button
            key={dealer.id}
            type="button"
            onClick={() => onChange(selected ? "" : String(dealer.id))}
            aria-pressed={selected}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              selected
                ? "border-sky-500 bg-sky-500/15 text-sky-200"
                : "border-gray-700 bg-gray-900/80 text-gray-400 hover:border-gray-500 hover:text-gray-200"
            }`}
          >
            {dealer.name}
          </button>
        );
      })}
    </div>
  );
}

function DealerListingPicker({
  listings,
  loading,
  selectedMobileId,
  prefillingMobileId,
  error,
  onSelect,
}: {
  listings: DealerListingSummary[];
  loading: boolean;
  selectedMobileId: string | null;
  prefillingMobileId: string | null;
  error: string;
  onSelect: (mobileId: string) => void;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4 text-sm text-gray-400">
        Зареждане на обявите...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-800/60 bg-red-950/30 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4 text-sm text-gray-500">
        Няма активни обяви за този дилър.
      </div>
    );
  }

  return (
    <div className="ml-2.5">
      <div className="grid max-h-80 w-[calc(100%-10px)] gap-2 overflow-y-auto pr-2.5 md:grid-cols-2 xl:grid-cols-3">
        {listings.map((listing) => {
          const selected = selectedMobileId === listing.mobileId;
          const prefilling = prefillingMobileId === listing.mobileId;
          return (
            <button
              key={listing.mobileId}
              type="button"
              onClick={() => onSelect(listing.mobileId)}
              disabled={Boolean(prefillingMobileId)}
              className={`flex w-full items-center gap-2 rounded-md border px-1.5 py-1 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                selected
                  ? "border-sky-500 bg-sky-500/10"
                  : "border-gray-700 bg-gray-900/80 hover:border-gray-500 hover:bg-gray-800/80"
              }`}
            >
              {listing.thumb ? (
                <ImageWithFallback
                  src={listing.thumb}
                  alt={
                    `${listing.make} ${listing.model}`.trim() || "Listing image"
                  }
                  className="h-12 w-16 rounded object-contain"
                  style={{ aspectRatio: "4/3" }}
                  fallbackClassName="h-12 w-16 rounded bg-gray-800 text-gray-400"
                  fallbackLabel="Missing"
                />
              ) : (
                <div className="h-12 w-16 rounded bg-gray-800" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white">
                  {[listing.make, listing.model].filter(Boolean).join(" ") ||
                    listing.mobileId}
                </div>
                <div className="truncate text-xs text-gray-400">
                  {listing.title || "—"}
                </div>
                <div className="text-xs font-medium text-sky-300">
                  {prefilling ? "Зареждане..." : formatPrice(listing.price)}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FormSection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
      {title ? (
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

export default function NewListingForm({
  makes: initialMakes,
  transmissions,
  fuels,
  regions,
  dealers,
  initialDealerListingsByDealer,
  initialDealerId = "",
}: Props) {
  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY,
    dealerId: initialDealerId,
  }));
  const [makes, setMakes] = useState<MakeEntry[]>(initialMakes);
  const [makesLoading, setMakesLoading] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [selectedTemplateMobileId, setSelectedTemplateMobileId] = useState<
    string | null
  >(null);
  const [prefillingMobileId, setPrefillingMobileId] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedBackupId, setSavedBackupId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [openAutocomplete, setOpenAutocomplete] = useState<
    "make" | "model" | null
  >(null);

  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const selectedMake = useMemo(
    () =>
      makes.find(
        (entry) =>
          normalizeAutocompleteValue(entry.make) ===
          normalizeAutocompleteValue(form.make),
      ) ?? null,
    [form.make, makes],
  );
  const models = useMemo(() => selectedMake?.models ?? [], [selectedMake]);
  const makeOptions = useMemo(
    () =>
      sortMakeOptions(
        makes.map((entry) => ({
          value: entry.make,
          count: entry.count ?? null,
        })),
      ),
    [makes],
  );
  const modelOptions = useMemo(
    () =>
      models.map((entry) => ({
        value: entry.label,
        count: entry.count ?? null,
      })),
    [models],
  );
  const selectedMakeCount = useMemo(
    () => getSelectedOptionCount(makeOptions, form.make),
    [form.make, makeOptions],
  );
  const selectedModelCount = useMemo(
    () => getSelectedOptionCount(modelOptions, form.model),
    [form.model, modelOptions],
  );
  const showBatteryFields = BATTERY_FUELS.has(form.fuel);
  const dealerListings = useMemo(
    () =>
      form.dealerId ? (initialDealerListingsByDealer[form.dealerId] ?? []) : [],
    [form.dealerId, initialDealerListingsByDealer],
  );

  const loadCities = useCallback(async (regionValue: string) => {
    if (!regionValue) {
      setCities([]);
      return;
    }

    setCitiesLoading(true);
    try {
      const response = await fetch(
        `/api/mobile-bg/cities?region=${encodeURIComponent(regionValue)}`,
      );
      const data: City[] = await response.json();
      setCities(data);
    } catch {
      setCities([]);
    } finally {
      setCitiesLoading(false);
    }
  }, []);

  const loadMakes = useCallback(
    async (pubtype: string) => {
      setMakesLoading(true);
      try {
        const response = await fetch(
          `/api/mobile-bg/makes?pubtype=${encodeURIComponent(pubtype)}`,
        );
        const data: MakeEntry[] = await response.json();
        setMakes(data);
      } catch {
        setMakes(initialMakes);
      } finally {
        setMakesLoading(false);
      }
    },
    [initialMakes],
  );

  function resetForm() {
    setForm({
      ...EMPTY,
      dealerId: initialDealerId,
    });
    setCities([]);
    setSelectedTemplateMobileId(null);
    setPrefillingMobileId(null);
    setError("");
    setSaved(false);
    setSavedBackupId(null);
  }

  function toggleExtra(category: string, label: string) {
    setForm((prev) => {
      const current = prev.extras[category] ?? [];
      const next = current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label];
      return { ...prev, extras: { ...prev.extras, [category]: next } };
    });
  }

  async function onRegionChange(regionValue: string) {
    setField("region", regionValue);
    setField("city", "");
    await loadCities(regionValue);
  }

  async function onCategoryChange(pubtype: string) {
    setField("pubtype", pubtype);
    setField("make", "");
    setField("model", "");
    await loadMakes(pubtype);
  }

  function updateMake(value: string) {
    setOpenAutocomplete("model");
    setForm((prev) => {
      const selectedEntry =
        makes.find(
          (entry) =>
            normalizeAutocompleteValue(entry.make) ===
            normalizeAutocompleteValue(value),
        ) ?? null;
      const validModels = (selectedEntry?.models ?? []).map((entry) =>
        normalizeAutocompleteValue(entry.label),
      );
      const nextModel =
        prev.model &&
        validModels.includes(normalizeAutocompleteValue(prev.model))
          ? prev.model
          : "";
      return { ...prev, make: value, model: nextModel };
    });
  }

  async function onSave() {
    setError("");

    if (!form.dealerId) {
      setError("Изберете дилър.");
      return;
    }
    if (!form.make) {
      setError("Изберете марка.");
      return;
    }
    if (!form.priceOnRequest && !form.price) {
      setError('Въведете цена или маркирайте "Цена само при запитване".');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/editown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Грешка при запазване.");
        return;
      }
      setSavedBackupId(typeof data.id === "number" ? data.id : null);
      setSaved(true);
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function prefillFromListing(mobileId: string) {
    if (!form.dealerId) return;

    setPrefillingMobileId(mobileId);
    setError("");

    try {
      const response = await fetch(
        `/api/editown/dealers/${encodeURIComponent(form.dealerId)}/listings/${encodeURIComponent(mobileId)}`,
      );
      const data = (await response.json()) as PrefillResponse & {
        error?: string;
      };
      if (!response.ok) {
        setError(data.error || "Грешка при зареждане на обявата.");
        return;
      }

      const nextForm = data.form;
      if (nextForm.pubtype !== form.pubtype) {
        await loadMakes(nextForm.pubtype);
      }
      if (nextForm.region) {
        await loadCities(nextForm.region);
      } else {
        setCities([]);
      }
      setForm(nextForm);
      setSelectedTemplateMobileId(mobileId);
      setOpenAutocomplete(null);
    } catch (prefillError) {
      setError((prefillError as Error).message);
    } finally {
      setPrefillingMobileId(null);
    }
  }

  if (saved) {
    return (
      <div className="rounded-2xl border border-emerald-700/50 bg-emerald-950/40 p-8 text-center">
        <p className="text-lg font-semibold text-emerald-300">
          Черновата е запазена.
        </p>
        <div className="mt-4 flex items-center justify-center gap-4 text-sm">
          {savedBackupId ? (
            <Link
              href={`/mobilebg/backups/${savedBackupId}`}
              className="text-sky-300 underline hover:text-sky-200"
            >
              Отвори черновата
            </Link>
          ) : null}
          <button
            onClick={resetForm}
            className="text-gray-400 underline hover:text-white"
          >
            Нова обява
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <FormSection>
        <div className="mb-5">
          <div className="mt-2">
            <DealerSelector
              dealers={dealers}
              value={form.dealerId}
              onChange={(value) => {
                setField("dealerId", value);
                setSelectedTemplateMobileId(null);
              }}
            />
          </div>
          {form.dealerId ? (
            <div className="mt-3">
              <DealerListingPicker
                listings={dealerListings}
                loading={false}
                selectedMobileId={selectedTemplateMobileId}
                prefillingMobileId={prefillingMobileId}
                error=""
                onSelect={(mobileId) => void prefillFromListing(mobileId)}
              />
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_1.1fr_1fr_1fr_1fr_1fr]">
          <SelectField
            label="Основна категория"
            value={form.pubtype}
            onChange={onCategoryChange}
            options={MAIN_CATEGORIES.map((item) => ({
              value: item.value,
              label: item.label,
            }))}
            required
          />
          <div className="min-w-0 flex flex-col gap-1">
            <FieldLabel required>
              {makesLoading ? "Марка (зарежда...)" : "Марка"}
            </FieldLabel>
            <AutocompleteInput
              value={form.make}
              onChange={updateMake}
              options={makeOptions}
              placeholder="Type make"
              emptyLabel="No make matches"
              hideLowCountOnEmpty
              open={openAutocomplete === "make"}
              trailingText={
                selectedMakeCount != null
                  ? selectedMakeCount.toLocaleString("en-US")
                  : null
              }
              onOpenChange={(open) => {
                if (open) {
                  setOpenAutocomplete("make");
                  return;
                }
                setOpenAutocomplete((current) =>
                  current === "make" ? null : current,
                );
              }}
            />
          </div>
          <div className="min-w-0 flex flex-col gap-1">
            <FieldLabel>Модел</FieldLabel>
            <AutocompleteInput
              value={form.model}
              onChange={(value) => setField("model", value)}
              options={modelOptions}
              placeholder="Type model"
              emptyLabel="No model matches"
              open={openAutocomplete === "model"}
              focusWhenOpen
              trailingText={
                selectedModelCount != null
                  ? selectedModelCount.toLocaleString("en-US")
                  : null
              }
              onOpenChange={(open) => {
                if (open) {
                  setOpenAutocomplete("model");
                  return;
                }
                setOpenAutocomplete((current) =>
                  current === "model" ? null : current,
                );
              }}
            />
          </div>
          <InputField
            label="Заглавие"
            value={form.title}
            onChange={(value) => setField("title", value)}
            maxLength={50}
          />
          <SelectField
            label="Двигател"
            value={form.fuel}
            onChange={(value) => setField("fuel", value)}
            options={["", ...fuels.filter(Boolean)]}
            accent
          />
          <SelectField
            label="Състояние"
            value={form.condition}
            onChange={(value) => setField("condition", value)}
            options={CONDITION_OPTIONS}
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr_1.1fr_1.1fr]">
          <InputField
            label="Мощност [к.с.]"
            value={form.power}
            onChange={(value) => setField("power", value)}
            type="number"
            maxLength={4}
          />
          <SelectField
            label="Евростандарт"
            value={form.euronorm}
            onChange={(value) => setField("euronorm", value)}
            options={EURO_OPTIONS}
          />
          <SelectField
            label="Скоростна кутия"
            value={form.transmission}
            onChange={(value) => setField("transmission", value)}
            options={["", ...transmissions.filter(Boolean)]}
            accent
          />
          <SelectField
            label="Категория"
            value={form.bodyType}
            onChange={(value) => setField("bodyType", value)}
            options={BODY_TYPE_OPTIONS}
            accent
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <InputField
            label="Кубатура [куб.см]"
            value={form.engineCc}
            onChange={(value) => setField("engineCc", value)}
            type="number"
            maxLength={5}
          />
          <InputField
            label="Пробег с едно зареждане (WLTP) [км]"
            value={form.batteryRange}
            onChange={(value) => setField("batteryRange", value)}
            type="number"
            maxLength={4}
            accent
            disabled={!showBatteryFields}
          />
          <InputField
            label="Капацитет на батерията [kWh]"
            value={form.batteryCapacity}
            onChange={(value) => setField("batteryCapacity", value)}
            type="number"
            maxLength={7}
            accent
            disabled={!showBatteryFields}
          />
        </div>
      </FormSection>

      <FormSection title="Цена И Производство">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <div className="grid gap-4 md:grid-cols-[90px_1fr_90px]">
              <InputField
                label="Цена"
                value={form.price}
                onChange={(value) => setField("price", value)}
                type="number"
                maxLength={7}
                accent
              />
              <SelectField
                label="ДДС"
                value={form.vat}
                onChange={(value) => setField("vat", value)}
                options={[
                  "",
                  "Частна продажба. / Освободена от ДДС продажба.",
                  "Цената е с включено ДДС",
                  "Цената е без ДДС",
                ]}
                accent
              />
              <SelectField
                label="Валута"
                value={form.currency}
                onChange={(value) => setField("currency", value)}
                options={CURRENCY_OPTIONS}
                accent
              />
            </div>
            <div className="mt-4">
              <CheckboxField
                label="Цена само при запитване"
                checked={form.priceOnRequest}
                onChange={(checked) => setField("priceOnRequest", checked)}
              />
            </div>
          </div>

          <InputField
            label="Пробег [км]"
            value={form.mileage}
            onChange={(value) => setField("mileage", value)}
            type="number"
            maxLength={7}
            accent
          />

          <div className="min-w-0 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="Месец"
                value={form.productionMonth}
                onChange={(value) => setField("productionMonth", value)}
                options={MONTH_OPTIONS}
                accent
              />
              <SelectField
                label="Година"
                value={form.productionYear}
                onChange={(value) => setField("productionYear", value)}
                options={PRODUCTION_YEAR_OPTIONS}
                accent
              />
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection title="Цвят И Локация">
        <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_1fr_1.1fr]">
          <SelectField
            label="Цвят"
            value={form.color}
            onChange={(value) => setField("color", value)}
            options={COLOR_OPTIONS}
          />
          <SelectField
            label="Намира се в"
            value={form.region}
            onChange={onRegionChange}
            options={[
              "",
              ...regions.map(
                (region) =>
                  ({ value: region.value, label: region.label }) as const,
              ),
            ]}
            accent
          />
          <SelectField
            label="Град"
            value={form.city}
            onChange={(value) => setField("city", value)}
            options={[
              "",
              ...cities.map(
                (city) => ({ value: city.value, label: city.label }) as const,
              ),
            ]}
            accent
            disabled={!form.region || citiesLoading}
          />
          <InputField
            label="VIN номер"
            value={form.vin}
            onChange={(value) => setField("vin", value)}
            maxLength={17}
          />
        </div>
      </FormSection>

      <FormSection title="Екстри">
        <div className="grid gap-4 xl:grid-cols-5 md:grid-cols-2">
          {EXTRA_SECTIONS.map((section) => (
            <ExtrasColumn
              key={section.category}
              category={section.category}
              items={section.items}
              selected={form.extras[section.category] ?? []}
              onToggle={(label) => toggleExtra(section.category, label)}
            />
          ))}
        </div>
      </FormSection>

      <FormSection title="Описание И Контакт">
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <FieldLabel>Допълнителна информация</FieldLabel>
            <textarea
              value={form.description}
              onChange={(event) => setField("description", event.target.value)}
              rows={10}
              maxLength={11000}
              className="mt-2 w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <h3 className="mb-4 text-sm font-semibold text-white">
              Данни за обратна връзка
            </h3>
            <div className="space-y-4">
              <InputField
                label="Мобилен телефон"
                value={form.phone}
                onChange={(value) => setField("phone", value)}
                maxLength={14}
                accent
              />
              <InputField
                label="Електронна поща"
                value={form.email}
                onChange={(value) => setField("email", value)}
                maxLength={40}
                accent
              />
              <InputField
                label="http://"
                value={form.website}
                onChange={(value) => setField("website", value)}
                maxLength={40}
              />
            </div>
            <p className="mt-6 text-xs text-sky-300">
              Оцветените в синьо полета са задължителни в Mobile.bg.
            </p>
          </div>
        </div>
      </FormSection>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <div className="flex items-center gap-4">
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-full bg-sky-500 px-6 py-2.5 text-sm font-semibold text-gray-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Запазване..." : "Запази обявата"}
        </button>
        <button
          onClick={resetForm}
          className="text-sm text-gray-400 hover:text-white"
        >
          Изчисти
        </button>
      </div>
    </div>
  );
}
