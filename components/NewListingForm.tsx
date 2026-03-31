'use client';

import { useState, useCallback } from 'react';
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

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1949 }, (_, i) => String(CURRENT_YEAR - i));

// mobile.bg main categories — value is the pubtype(s) used for makes/models filtering
const MAIN_CATEGORIES = [
  { value: '1,2', label: 'Автомобили и джипове' },
  { value: '3',   label: 'Бусове / Микробуси' },
  { value: '4',   label: 'Товарни автомобили' },
  { value: '7',   label: 'Мотоциклети / Мотопеди' },
  { value: '9',   label: 'Водни МПС' },
  { value: '11',  label: 'Ремаркета' },
  { value: '12',  label: 'Специална техника' },
];

const VAT_OPTIONS = [
  { value: '', label: '—' },
  { value: 'Цената е с включено ДДС', label: 'С включено ДДС' },
  { value: 'Частна продажба. / Освободена от ДДС продажба.', label: 'Освободена от ДДС' },
];

// All extras grouped by category, in mobile.bg order
const EXTRAS: Record<string, string[]> = {
  'Безопасност': [
    'Антиблокираща система',
    'Въздушни възглавници - Предни',
    'Въздушни възглавници - Задни',
    'Въздушни възглавници - Странични',
    'Ел. разпределяне на спирачното усилие',
    'Електронна програма за стабилизиране',
    'Автоматичен контрол на стабилността',
    'Система за динамична устойчивост',
    'Система за защита от пробуксуване',
    'Система за подпомагане на спирането',
    'Система за изсушаване на накладките',
    'Система за контрол на дистанцията',
    'Система за контрол на спускането',
    'Контрол на налягането на гумите',
    'Адаптивни предни светлини',
    'GPS система за проследяване',
    'Парктроник',
    'Система ISOFIX',
  ],
  'Комфорт': [
    'Климатик',
    'Климатроник',
    'Навигация',
    'Мултифункционален волан',
    'Регулиране на волана',
    'Отопление на волана',
    'Бордкомпютър',
    'Стерео уредба',
    'USB, audio\\video, IN\\AUX изводи',
    'Bluetooth \\ handsfree система',
    'DVD, TV',
    'Ел. Стъкла',
    'Ел. Огледала',
    'Ел. регулиране на седалките',
    'Подгряване на седалките',
    'Подгряване на предното стъкло',
    'Ел. регулиране на окачването',
    'Адаптивно въздушно окачване',
    'Ел. усилвател на волана',
    'Серво усилвател на волана',
    'Система за контрол на скоростта (автопилот)',
    'Безключово палене',
    'Auto Start Stop function',
    'Steptronic, Tiptronic',
    'Датчик за светлина',
    'Сензор за дъжд',
    'Система за измиване на фаровете',
    'Термопомпа',
    'Хладилна жабка',
    'Печка',
  ],
  'Екстериор': [
    '4(5) Врати',
    'Шибедах',
    'Панорамен люк',
    'Рейлинг на покрива',
    'Лети джанти',
    'Теглич',
    'Металик',
    'Халогенни фарове',
    'Ксенонови фарове',
    'LED фарове',
    'Спойлери',
  ],
  'Интериор': [
    'Кожен салон',
    'Велурен салон',
  ],
  'Защита': [
    'Аларма',
    'Централно заключване',
    'Каско',
    'OFFROAD пакет',
  ],
  'Други': [
    '4x4',
    '7 места',
    'Газова уредба',
    'Дълга база',
    'Бартер',
    'Лизинг',
    'Нов внос',
    'Напълно обслужен',
    'С регистрация',
    'Сервизна книжка',
    'Тунинг',
  ],
};

type FormState = {
  dealerId: string;
  // mobile.bg pubtype (Основна категория)
  pubtype: string;
  // f5 / f6
  make: string;
  model: string;
  // f11
  bodyType: string;
  // year
  year: string;
  // f8
  fuel: string;
  // f9
  power: string;
  // f30
  engineCc: string;
  // f10
  transmission: string;
  // f16
  mileage: string;
  // f17
  color: string;
  // f18 / f19
  region: string;
  city: string;
  // f12
  price: string;
  // f31
  vat: string;
  // f7
  title: string;
  // f21
  description: string;
  // extras checkboxes: category → selected labels
  extras: Record<string, string[]>;
};

const EMPTY: FormState = {
  dealerId: '', pubtype: '1,2', make: '', model: '', bodyType: '', year: '',
  fuel: '', power: '', engineCc: '', transmission: '', mileage: '', color: '',
  region: '', city: '', price: '', vat: '', title: '', description: '',
  extras: {},
};

// ─── Primitive field components ──────────────────────────────────────────────

function Select({
  label, value, onChange, children, required, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  children: React.ReactNode; required?: boolean; disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
      >
        <option value="">—</option>
        {children}
      </select>
    </div>
  );
}

function Input({
  label, value, onChange, type = 'text', placeholder, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void; }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={6}
        className="rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none resize-y"
      />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 pt-2 border-t border-gray-700/60">
      {children}
    </h3>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-700/60 bg-gray-800/30 p-5 space-y-4">
      {children}
    </div>
  );
}

// ─── Extras checkbox group ────────────────────────────────────────────────────

function ExtrasGroup({
  category, items, selected, onToggle,
}: {
  category: string;
  items: string[];
  selected: string[];
  onToggle: (label: string) => void;
}) {
  return (
    <div className="rounded border border-gray-700/40 bg-gray-900/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">{category}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {items.map(label => (
          <label key={label} className="flex items-start gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={selected.includes(label)}
              onChange={() => onToggle(label)}
              className="mt-0.5 shrink-0 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-0 focus:ring-offset-0"
            />
            <span className="text-xs text-gray-300 group-hover:text-white leading-tight">{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Main form component ──────────────────────────────────────────────────────

export default function NewListingForm({ makes: initialMakes, fuels, transmissions, bodyTypes, regions, colors, dealers }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [makes, setMakes] = useState<MakeEntry[]>(initialMakes);
  const [makesLoading, setMakesLoading] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedBackupId, setSavedBackupId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const set = useCallback((key: keyof Omit<FormState, 'extras'>) => (value: string) =>
    setForm(prev => ({ ...prev, [key]: value })), []);

  const selectedMake = makes.find(m => m.make === form.make);
  const models = selectedMake?.models ?? [];

  function toggleExtra(category: string, label: string) {
    setForm(prev => {
      const current = prev.extras[category] ?? [];
      const updated = current.includes(label)
        ? current.filter(l => l !== label)
        : [...current, label];
      return { ...prev, extras: { ...prev.extras, [category]: updated } };
    });
  }

  async function onRegionChange(regionValue: string) {
    set('region')(regionValue);
    set('city')('');
    setCities([]);
    if (!regionValue) return;
    setCitiesLoading(true);
    try {
      const res = await fetch(`/api/mobile-bg/cities?region=${encodeURIComponent(regionValue)}`);
      const data: City[] = await res.json();
      setCities(data);
    } catch {
      setCities([]);
    } finally {
      setCitiesLoading(false);
    }
  }

  async function onSave() {
    setError('');
    if (!form.dealerId) { setError('Изберете дилър'); return; }
    if (!form.make)     { setError('Изберете марка'); return; }
    if (!form.price)    { setError('Въведете цена'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/editown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Грешка при запазване'); return; }
      setSavedBackupId(typeof data.id === 'number' ? data.id : null);
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <div className="rounded-lg border border-emerald-700/60 bg-emerald-900/20 p-8 text-center">
        <p className="text-emerald-300 text-lg font-medium">Обявата е запазена!</p>
        <div className="mt-4 flex items-center justify-center gap-4 text-sm">
          {savedBackupId ? (
            <Link href={`/mobilebg/backups/${savedBackupId}`} className="text-blue-300 hover:text-blue-200 underline">
              Отвори черновата
            </Link>
          ) : null}
          <button
            onClick={() => { setForm(EMPTY); setSaved(false); setSavedBackupId(null); }}
            className="text-gray-400 hover:text-white underline"
          >
            Нова обява
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Dealer */}
      <Card>
        <SectionTitle>Дилър</SectionTitle>
        <Select label="Дилър" value={form.dealerId} onChange={set('dealerId')} required>
          {dealers.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
        </Select>
      </Card>

      {/* Make, model, category */}
      <Card>
        <SectionTitle>Марка и категория</SectionTitle>

        {/* Основна категория — full width */}
        <Select label="Основна категория" value={form.pubtype}
          onChange={async v => {
            set('pubtype')(v); set('make')(''); set('model')('');
            setMakesLoading(true);
            try {
              const res = await fetch(`/api/mobile-bg/makes?pubtype=${v}`);
              setMakes(await res.json());
            } catch { /* keep existing */ } finally { setMakesLoading(false); }
          }} required>
          {MAIN_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </Select>

        <div className="grid grid-cols-2 gap-4">
          <Select label={makesLoading ? 'Марка (зарежда…)' : 'Марка'} value={form.make}
            onChange={v => { set('make')(v); set('model')(''); }} required disabled={makesLoading}>
            {makes.map(m => <option key={m.make} value={m.make}>{m.make}</option>)}
          </Select>

          <Select label="Модел" value={form.model} onChange={set('model')} disabled={!form.make}>
            {models.map(m => <option key={m.label} value={m.label}>{m.label}</option>)}
          </Select>

          <Select label="Тип / Категория" value={form.bodyType} onChange={set('bodyType')}>
            {bodyTypes.map(b => <option key={b} value={b}>{b}</option>)}
          </Select>

          <Select label="Год. производство" value={form.year} onChange={set('year')}>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </Select>
        </div>
      </Card>

      {/* Engine */}
      <Card>
        <SectionTitle>Двигател и скоростна кутия</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Двигател" value={form.fuel} onChange={set('fuel')}>
            {fuels.map(f => <option key={f} value={f}>{f}</option>)}
          </Select>

          <Select label="Скоростна кутия" value={form.transmission} onChange={set('transmission')}>
            {transmissions.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Мощност (к.с.)" type="number" value={form.power} onChange={set('power')} placeholder="150" />
          <Input label="Кубатура (куб.см)" type="number" value={form.engineCc} onChange={set('engineCc')} placeholder="1995" />
        </div>
      </Card>

      {/* Mileage + color */}
      <Card>
        <SectionTitle>Пробег и цвят</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Пробег (км)" type="number" value={form.mileage} onChange={set('mileage')} placeholder="100000" />
          <Select label="Цвят" value={form.color} onChange={set('color')}>
            {colors.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
      </Card>

      {/* Location */}
      <Card>
        <SectionTitle>Намира се в</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Област" value={form.region} onChange={onRegionChange}>
            {regions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Населено място</label>
            <select
              value={form.city}
              onChange={e => set('city')(e.target.value)}
              disabled={!form.region || citiesLoading}
              className="rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
            >
              <option value="">{citiesLoading ? 'Зарежда...' : '—'}</option>
              {cities.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* Price */}
      <Card>
        <SectionTitle>Цена</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Цена (EUR)" type="number" value={form.price} onChange={set('price')} placeholder="15000" required />
          <Select label="ДДС" value={form.vat} onChange={set('vat')}>
            {VAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
      </Card>

      {/* Text */}
      <Card>
        <SectionTitle>Текст на обявата</SectionTitle>
        <Input label="Заглавие" value={form.title} onChange={set('title')}
          placeholder="BMW 320d xDrive Sport Line" />
        <Textarea label="Описание" value={form.description} onChange={set('description')} />
      </Card>

      {/* Extras */}
      <Card>
        <SectionTitle>Екстри</SectionTitle>
        <div className="space-y-3">
          {Object.entries(EXTRAS).map(([category, items]) => (
            <ExtrasGroup
              key={category}
              category={category}
              items={items}
              selected={form.extras[category] ?? []}
              onToggle={label => toggleExtra(category, label)}
            />
          ))}
        </div>
      </Card>

      {/* Actions */}
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex items-center gap-4 pb-8">
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? 'Запазва...' : 'Запази обявата'}
        </button>
        <button
          onClick={() => setForm(EMPTY)}
          className="text-sm text-gray-500 hover:text-gray-300"
        >
          Изчисти
        </button>
      </div>
    </div>
  );
}
