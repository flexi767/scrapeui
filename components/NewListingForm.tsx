'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import type { MakeEntry } from '@/lib/mobile-bg/makes-models';
import type { Region, City } from '@/lib/mobile-bg/regions';

interface Dealer { id: number; slug: string; name: string; }

interface Props {
  makes: MakeEntry[];
  fuels: string[];
  transmissions: string[];
  bodyTypes: string[];
  regions: Region[];
  colors: string[];
  dealers: Dealer[];
}

const MAIN_CATEGORIES = [
  { value: '1,2', label: 'Автомобили и джипове' },
  { value: '3', label: 'Бусове / Микробуси' },
  { value: '4', label: 'Товарни автомобили' },
  { value: '7', label: 'Мотоциклети / Мотопеди' },
  { value: '9', label: 'Водни МПС' },
  { value: '11', label: 'Ремаркета' },
  { value: '12', label: 'Специална техника' },
];

const CONDITION_OPTIONS = [
  { value: '1', label: 'Нов', disabled: true },
  { value: '0', label: 'Употребяван' },
  { value: '3', label: 'Повреден/ударен' },
  { value: '2', label: 'За части' },
];

const EURO_OPTIONS = ['', 'Евро 1', 'Евро 2', 'Евро 3', 'Евро 4', 'Евро 5', 'Евро 6'];
const CURRENCY_OPTIONS = ['EUR', 'USD'];
const MONTH_OPTIONS = [
  '',
  'януари',
  'февруари',
  'март',
  'април',
  'май',
  'юни',
  'юли',
  'август',
  'септември',
  'октомври',
  'ноември',
  'декември',
];
const PRODUCTION_YEAR_OPTIONS = [
  '',
  ...Array.from({ length: new Date().getFullYear() - 1929 }, (_, index) => String(new Date().getFullYear() - index)),
];
const BODY_TYPE_OPTIONS = [
  '',
  'Ван',
  'Джип',
  'Кабрио',
  'Комби',
  'Купе',
  'Миниван',
  'Пикап',
  'Седан',
  'Стреч лимузина',
  'Хечбек',
];
const COLOR_OPTIONS = [
  '',
  'Tъмно син',
  'Банан',
  'Беата',
  'Бежов',
  'Бордо',
  'Бронз',
  'Бял',
  'Винен',
  'Виолетов',
  'Вишнев',
  'Графит',
  'Жълт',
  'Зелен',
  'Златист',
  'Кафяв',
  'Керемиден',
  'Кремав',
  'Лилав',
  'Металик',
  'Оранжев',
  'Охра',
  'Пепеляв',
  'Перла',
  'Пясъчен',
  'Резидав',
  'Розов',
  'Сахара',
  'Светло сив',
  'Светло син',
  'Сив',
  'Син',
  'Слонова кост',
  'Сребърен',
  'Т.зелен',
  'Тъмно сив',
  'Тъмно син мет.',
  'Тъмно червен',
  'Тютюн',
  'Хамелеон',
  'Червен',
  'Черен',
];

const EXTRA_SECTIONS = [
  {
    category: 'Безопасност',
    items: [
      'GPS система за проследяване',
      'Автоматичен контрол на стабилността',
      'Адаптивни предни светлини',
      'Антиблокираща система',
      'Въздушни възглавници - Задни',
      'Въздушни възглавници - Предни',
      'Въздушни възглавници - Странични',
      'Ел. разпределяне на спирачното усилие',
      'Електронна програма за стабилизиране',
      'Контрол на налягането на гумите',
      'Парктроник',
      'Система ISOFIX',
      'Система за динамична устойчивост',
      'Система за защита от пробуксуване',
      'Система за изсушаване на накладките',
      'Система за контрол на дистанцията',
      'Система за контрол на спускането',
      'Система за подпомагане на спирането',
    ],
  },
  {
    category: 'Комфорт',
    items: [
      'Auto Start Stop function',
      'Bluetooth \\ handsfree система',
      'DVD, TV',
      'Steptronic, Tiptronic',
      'USB, audio\\video, IN\\AUX изводи',
      'Адаптивно въздушно окачване',
      'Безключово палене',
      'Блокаж на диференциала',
      'Бордкомпютър',
      'Бързи \\ бавни скорости',
      'Датчик за светлина',
      'Ел. Огледала',
      'Ел. Стъкла',
      'Ел. регулиране на окачването',
      'Ел. регулиране на седалките',
      'Ел. усилвател на волана',
      'Климатик',
      'Климатроник',
      'Мултифункционален волан',
      'Навигация',
      'Отопление на волана',
      'Печка',
      'Подгряване на предното стъкло',
      'Подгряване на седалките',
      'Регулиране на волана',
      'Сензор за дъжд',
      'Серво усилвател на волана',
      'Система за измиване на фаровете',
      'Система за контрол на скоростта (автопилот)',
      'Стерео уредба',
      'Термопомпа',
      'Хладилна жабка',
    ],
  },
  {
    category: 'Други',
    items: [
      '4x4',
      '7 места',
      'Buy back',
      'Бартер',
      'Газова уредба',
      'Дълга база',
      'Капариран\\Продаден',
      'Катастрофирал',
      'Къса база',
      'Лизинг',
      'Метанова уредба',
      'На части',
      'Напълно обслужен',
      'Нов внос',
      'С регистрация',
      'Сервизна книжка',
      'Тунинг',
    ],
  },
  {
    category: 'Екстериор',
    items: [
      '2(3) Врати',
      '4(5) Врати',
      'LED фарове',
      'Ксенонови фарове',
      'Лети джанти',
      'Металик',
      'Панорамен люк',
      'Рейлинг на покрива',
      'Спойлери',
      'Теглич',
      'Халогенни фарове',
      'Шибедах',
    ],
  },
  {
    category: 'Защита',
    items: [
      'OFFROAD пакет',
      'Аларма',
      'Брониран',
      'Каско',
      'Лебедка',
      'Централно заключване',
    ],
  },
  {
    category: 'Интериор',
    items: [
      'Велурен салон',
      'Десен волан',
      'Кожен салон',
    ],
  },
  {
    category: 'Специализирани',
    items: [
      'TAXI',
      'За хора с увреждания',
      'Катафалка',
      'Линейка',
      'Учебен',
      'Хладилен',
      'Хомологация N1',
    ],
  },
] as const;

const BATTERY_FUELS = new Set(['Електрически', 'Хибриден', 'Plug-in хибрид', 'Водород']);

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
  dealerId: '',
  pubtype: '1,2',
  make: '',
  model: '',
  title: '',
  fuel: '',
  condition: '0',
  power: '',
  euronorm: '',
  transmission: '',
  bodyType: '',
  engineCc: '',
  batteryRange: '',
  batteryCapacity: '',
  price: '',
  vat: '',
  currency: 'EUR',
  mileage: '',
  productionMonth: '',
  productionYear: '',
  color: '',
  region: '',
  city: '',
  vin: '',
  description: '',
  phone: '',
  email: '',
  website: '',
  priceOnRequest: false,
  extras: {},
};

function FieldLabel({ children, required = false, accent = false }: { children: React.ReactNode; required?: boolean; accent?: boolean }) {
  return (
    <label className={`text-xs font-medium ${accent ? 'text-sky-300' : 'text-gray-400'} uppercase tracking-wide`}>
      {children}
      {required ? <span className="ml-1 text-red-400">*</span> : null}
    </label>
  );
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
    <div className="flex flex-col gap-1">
      <FieldLabel required={required} accent={accent}>{label}</FieldLabel>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {options.map((option) => {
          if (typeof option === 'string') {
            return <option key={`${label}-${option || 'empty'}`} value={option}>{option || ' '}</option>;
          }
          return (
            <option key={`${label}-${option.value}`} value={option.value} disabled={option.disabled}>
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
  type = 'text',
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
    <div className="flex flex-col gap-1">
      <FieldLabel required={required} accent={accent}>{label}</FieldLabel>
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
          <label key={item} className="flex cursor-pointer items-start gap-2 text-xs text-gray-300">
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

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">{title}</h2>
      {children}
    </section>
  );
}

export default function NewListingForm({ makes: initialMakes, fuels, transmissions, regions, dealers }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [makes, setMakes] = useState<MakeEntry[]>(initialMakes);
  const [makesLoading, setMakesLoading] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedBackupId, setSavedBackupId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const selectedMake = useMemo(
    () => makes.find((entry) => entry.make === form.make) ?? null,
    [form.make, makes],
  );
  const models = selectedMake?.models ?? [];
  const showBatteryFields = BATTERY_FUELS.has(form.fuel);

  function resetForm() {
    setForm(EMPTY);
    setCities([]);
    setError('');
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
    setField('region', regionValue);
    setField('city', '');
    setCities([]);
    if (!regionValue) return;

    setCitiesLoading(true);
    try {
      const response = await fetch(`/api/mobile-bg/cities?region=${encodeURIComponent(regionValue)}`);
      const data: City[] = await response.json();
      setCities(data);
    } catch {
      setCities([]);
    } finally {
      setCitiesLoading(false);
    }
  }

  async function onCategoryChange(pubtype: string) {
    setField('pubtype', pubtype);
    setField('make', '');
    setField('model', '');
    setMakesLoading(true);
    try {
      const response = await fetch(`/api/mobile-bg/makes?pubtype=${encodeURIComponent(pubtype)}`);
      const data: MakeEntry[] = await response.json();
      setMakes(data);
    } catch {
      setMakes(initialMakes);
    } finally {
      setMakesLoading(false);
    }
  }

  async function onSave() {
    setError('');

    if (!form.dealerId) {
      setError('Изберете дилър.');
      return;
    }
    if (!form.make) {
      setError('Изберете марка.');
      return;
    }
    if (!form.priceOnRequest && !form.price) {
      setError('Въведете цена или маркирайте "Цена само при запитване".');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/editown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Грешка при запазване.');
        return;
      }
      setSavedBackupId(typeof data.id === 'number' ? data.id : null);
      setSaved(true);
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="rounded-2xl border border-emerald-700/50 bg-emerald-950/40 p-8 text-center">
        <p className="text-lg font-semibold text-emerald-300">Черновата е запазена.</p>
        <div className="mt-4 flex items-center justify-center gap-4 text-sm">
          {savedBackupId ? (
            <Link href={`/mobilebg/backups/${savedBackupId}`} className="text-sky-300 underline hover:text-sky-200">
              Отвори черновата
            </Link>
          ) : null}
          <button onClick={resetForm} className="text-gray-400 underline hover:text-white">
            Нова обява
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <FormSection title="Основни Данни">
        <div className="mb-5">
          <SelectField
            label="Дилър"
            value={form.dealerId}
            onChange={(value) => setField('dealerId', value)}
            options={dealers.map((dealer) => ({ value: String(dealer.id), label: dealer.name }))}
            required
            accent
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_1.1fr_1fr_1fr_1fr]">
          <SelectField
            label="Основна категория"
            value={form.pubtype}
            onChange={onCategoryChange}
            options={MAIN_CATEGORIES.map((item) => ({ value: item.value, label: item.label }))}
            required
          />
          <SelectField
            label={makesLoading ? 'Марка (зарежда...)' : 'Марка'}
            value={form.make}
            onChange={(value) => {
              setField('make', value);
              setField('model', '');
            }}
            options={['', ...makes.map((entry) => entry.make)]}
            required
            disabled={makesLoading}
          />
          <SelectField
            label="Модел"
            value={form.model}
            onChange={(value) => setField('model', value)}
            options={['', ...models.map((entry) => entry.label)]}
            disabled={!form.make}
          />
          <InputField label="Заглавие" value={form.title} onChange={(value) => setField('title', value)} maxLength={50} />
          <SelectField
            label="Състояние"
            value={form.condition}
            onChange={(value) => setField('condition', value)}
            options={CONDITION_OPTIONS}
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr_1.1fr_1.1fr]">
          <InputField label="Мощност [к.с.]" value={form.power} onChange={(value) => setField('power', value)} type="number" maxLength={4} />
          <SelectField
            label="Евростандарт"
            value={form.euronorm}
            onChange={(value) => setField('euronorm', value)}
            options={EURO_OPTIONS}
          />
          <SelectField
            label="Скоростна кутия"
            value={form.transmission}
            onChange={(value) => setField('transmission', value)}
            options={['', ...transmissions.filter(Boolean)]}
            accent
          />
          <SelectField
            label="Категория"
            value={form.bodyType}
            onChange={(value) => setField('bodyType', value)}
            options={BODY_TYPE_OPTIONS}
            accent
          />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <InputField label="Кубатура [куб.см]" value={form.engineCc} onChange={(value) => setField('engineCc', value)} type="number" maxLength={5} />
          <InputField
            label="Пробег с едно зареждане (WLTP) [км]"
            value={form.batteryRange}
            onChange={(value) => setField('batteryRange', value)}
            type="number"
            maxLength={4}
            accent
            disabled={!showBatteryFields}
          />
          <InputField
            label="Капацитет на батерията [kWh]"
            value={form.batteryCapacity}
            onChange={(value) => setField('batteryCapacity', value)}
            type="number"
            maxLength={7}
            accent
            disabled={!showBatteryFields}
          />
        </div>
      </FormSection>

      <FormSection title="Цена И Производство">
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr]">
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <div className="grid gap-4 md:grid-cols-[90px_1fr_90px]">
              <InputField label="Цена" value={form.price} onChange={(value) => setField('price', value)} type="number" maxLength={7} accent />
              <SelectField label="ДДС" value={form.vat} onChange={(value) => setField('vat', value)} options={['', 'Частна продажба. / Освободена от ДДС продажба.', 'Цената е с включено ДДС', 'Цената е без ДДС']} accent />
              <SelectField label="Валута" value={form.currency} onChange={(value) => setField('currency', value)} options={CURRENCY_OPTIONS} accent />
            </div>
            <div className="mt-4">
              <CheckboxField
                label="Цена само при запитване"
                checked={form.priceOnRequest}
                onChange={(checked) => setField('priceOnRequest', checked)}
              />
            </div>
          </div>

          <InputField label="Пробег [км]" value={form.mileage} onChange={(value) => setField('mileage', value)} type="number" maxLength={7} accent />

          <div className="grid gap-4 md:grid-cols-2">
            <SelectField label="Месец" value={form.productionMonth} onChange={(value) => setField('productionMonth', value)} options={MONTH_OPTIONS} accent />
            <SelectField label="Година" value={form.productionYear} onChange={(value) => setField('productionYear', value)} options={PRODUCTION_YEAR_OPTIONS} accent />
          </div>
        </div>
      </FormSection>

      <FormSection title="Цвят И Локация">
        <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_1fr_1.1fr]">
          <SelectField label="Цвят" value={form.color} onChange={(value) => setField('color', value)} options={COLOR_OPTIONS} />
          <SelectField
            label="Намира се в"
            value={form.region}
            onChange={onRegionChange}
            options={['', ...regions.map((region) => ({ value: region.value, label: region.label } as const))]}
            accent
          />
          <SelectField
            label="Град"
            value={form.city}
            onChange={(value) => setField('city', value)}
            options={['', ...cities.map((city) => ({ value: city.value, label: city.label } as const))]}
            accent
            disabled={!form.region || citiesLoading}
          />
          <InputField label="VIN номер" value={form.vin} onChange={(value) => setField('vin', value)} maxLength={17} />
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
              onChange={(event) => setField('description', event.target.value)}
              rows={10}
              maxLength={11000}
              className="mt-2 w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <h3 className="mb-4 text-sm font-semibold text-white">Данни за обратна връзка</h3>
            <div className="space-y-4">
              <InputField label="Мобилен телефон" value={form.phone} onChange={(value) => setField('phone', value)} maxLength={14} accent />
              <InputField label="Електронна поща" value={form.email} onChange={(value) => setField('email', value)} maxLength={40} accent />
              <InputField label="http://" value={form.website} onChange={(value) => setField('website', value)} maxLength={40} />
            </div>
            <p className="mt-6 text-xs text-sky-300">Оцветените в синьо полета са задължителни в Mobile.bg.</p>
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
          {saving ? 'Запазване...' : 'Запази обявата'}
        </button>
        <button onClick={resetForm} className="text-sm text-gray-400 hover:text-white">
          Изчисти
        </button>
      </div>
    </div>
  );
}
