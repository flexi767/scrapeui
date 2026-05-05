import fs from 'fs';
import path from 'path';
import { CARS_BG_BASE_URL } from '@/lib/cars-bg/auth';
import { USER_AGENT } from '@/lib/mobile-bg/constants';
import { parseJson } from '@/lib/utils';

// ── Internal types ─────────────────────────────────────────────────────────

export interface OptionEntry {
  id: number;
  label: string;
  normalized: string;
}

export interface OptionSet {
  options: OptionEntry[];
  sorted: OptionEntry[];
  map: Map<string, OptionEntry>;
}

export interface CarsBgSelectedExtra {
  name?: string;
  value?: string;
  id?: string;
  label?: string;
  checked?: boolean;
}

export interface CarsBgExtrasPayload {
  url?: string | null;
  summaryText?: string;
  selected?: CarsBgSelectedExtra[];
}

// ── Text normalization ──────────────────────────────────────────────────────

export function normalizeLabel(value = ''): string {
  return String(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9а-я\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeCompareText(value: string | null | undefined): string {
  return String(value || '')
    .replace(/[💵📞✓]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9а-я]+/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeCarsBgDescriptionText(value: string | null | undefined): string {
  return String(value || '').replace(/[💵📞✓]/gu, '✓');
}

export function sanitizeCarsBgDescription(value: string | null | undefined): string {
  return normalizeCarsBgDescriptionText(value)
    .replace(/(^|\s|[,.!?:;()\-])Възможност\s+за\s+данъчен\s+кредит(?=$|\s|[,.!?:;()\-])/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function normalizeCarsBgTitleText(value: string | null | undefined): string {
  return String(value || '').replace(/[💵📞✓]/gu, '');
}

export function sanitizeCarsBgTitle(value: string | null | undefined): string {
  return normalizeCarsBgTitleText(value).trim();
}

export function titleOverlapScore(a: string | null | undefined, b: string | null | undefined): number {
  const aTokens = new Set(normalizeCompareText(a).split(' ').filter((t) => t.length > 2));
  const bTokens = new Set(normalizeCompareText(b).split(' ').filter((t) => t.length > 2));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap++;
  }
  return overlap;
}

// ── Extras mapping ──────────────────────────────────────────────────────────

const EXTRA_LABEL_MAPPINGS: Record<string, string[]> = {
  [normalizeLabel('Ел. регулиране на седалките')]: ['Ел.седалки'],
  [normalizeLabel('Подгряване на седалките')]: ['Подгряване на седалки'],
  [normalizeLabel('Лети джанти')]: ['Алуминиеви джанти'],
  [normalizeLabel('Антиблокираща система')]: ['ABS'],
  [normalizeLabel('Електронна програма за стабилизиране')]: ['ESP'],
  [normalizeLabel('Въздушни възглавници - Предни')]: ['Airbag'],
  [normalizeLabel('Въздушни възглавници - Задни')]: ['Airbag'],
  [normalizeLabel('Въздушни възглавници - Странични')]: ['Airbag'],
  [normalizeLabel('Система за защита от пробуксуване')]: ['ASR/Тракшън контрол'],
  [normalizeLabel('Аларма')]: ['Имобилайзер'],
  [normalizeLabel('Централно заключване')]: ['Центр. заключване'],
  [normalizeLabel('Каско')]: ['Застраховка'],
  [normalizeLabel('Auto Start Stop function')]: ['Старт-Стоп система'],
  [normalizeLabel('Steptronic, Tiptronic')]: ['Типтроник/Мултитроник'],
  [normalizeLabel('Система за контрол на скоростта (автопилот)')]: ['Автопилот'],
  [normalizeLabel('Серво усилвател на волана')]: ['Серво управление'],
  [normalizeLabel('Бордкомпютър')]: ['Бордови компютър'],
  [normalizeLabel('Навигация')]: ['Навигационна система'],
  [normalizeLabel('Панорамен люк')]: ['Панорамен покрив'],
  [normalizeLabel('7 места')]: ['7 места (6+1)'],
};

export const EXTRA_BOOLEAN_FIELD_MAPPINGS: Record<string, string[]> = {
  usageId: [normalizeLabel('Нов внос')],
  metallic: [normalizeLabel('Металик')],
};

const EXTRA_BOOLEAN_FIELD_NEGATIONS: Record<string, string[]> = {
  usageId: [normalizeLabel('С регистрация')],
};

export function expandCarsBgExtraLabels(extraLabels: string[] = []): string[] {
  const expanded = new Set<string>();
  for (const label of extraLabels) {
    const normalized = normalizeLabel(label);
    if (!normalized) continue;
    expanded.add(normalized);
    for (const mapped of EXTRA_LABEL_MAPPINGS[normalized] || []) {
      const mappedNormalized = normalizeLabel(mapped);
      if (mappedNormalized) expanded.add(mappedNormalized);
    }
  }
  return Array.from(expanded);
}

export function hasMappedBooleanExtra(
  extraLabels: string[] = [],
  fieldName: keyof typeof EXTRA_BOOLEAN_FIELD_MAPPINGS,
): boolean {
  const expected = EXTRA_BOOLEAN_FIELD_MAPPINGS[fieldName];
  if (!expected?.length) return false;
  const normalized = new Set(extraLabels.map((label) => normalizeLabel(label)).filter(Boolean));
  const blockedBy = EXTRA_BOOLEAN_FIELD_NEGATIONS[fieldName] || [];
  if (blockedBy.some((label) => normalized.has(label))) return false;
  return expected.some((label) => normalized.has(label));
}

export { getExtraLabels } from '@/lib/mobile-bg/extras';

export function parseCarsBgExtrasPayload(extrasJson: string | null): CarsBgExtrasPayload | null {
  const parsed = parseJson<CarsBgExtrasPayload | null>(extrasJson, null);
  if (!parsed || !Array.isArray(parsed.selected)) return null;
  return parsed;
}

// ── Option sets (from publish form HTML) ───────────────────────────────────

const PUBLISH_FORM_PATHS = [
  path.resolve(process.cwd(), 'data/publishcar.html'),
  '/Users/v/dev/scrapers/data/publishcar.html',
];

function loadPublishFormHtml(): string {
  for (const filePath of PUBLISH_FORM_PATHS) {
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf8');
  }
  return '';
}

export function parseOptionMap(html: string, inputName: string): OptionSet {
  if (!html) return { options: [], sorted: [], map: new Map() };
  const regex = new RegExp(
    `<input[^>]*name=["']${inputName}["'][^>]*id=["'][^"']*_(\\d+)["'][^>]*?(?:value=["'](\\d+)["'])?[^>]*>\\s*<label[^>]*>([^<]+)<`,
    'gi',
  );
  const options: OptionEntry[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const id = Number(match[2] || match[1]);
    const label = match[3]?.trim();
    if (!label || Number.isNaN(id)) continue;
    options.push({ id, label, normalized: normalizeLabel(label) });
  }
  const sorted = [...options].sort((a, b) => b.normalized.length - a.normalized.length);
  const map = new Map(options.map((o) => [o.normalized, o]));
  return { options, sorted, map };
}

const publishFormHtml = loadPublishFormHtml();
export const optionSets = publishFormHtml
  ? {
      brand: parseOptionMap(publishFormHtml, 'brandId'),
      category: parseOptionMap(publishFormHtml, 'categoryId'),
      condition: parseOptionMap(publishFormHtml, 'conditionId'),
      currency: parseOptionMap(publishFormHtml, 'currencyId'),
      color: parseOptionMap(publishFormHtml, 'colorId'),
      doors: parseOptionMap(publishFormHtml, 'doorId'),
    }
  : null;

const modelOptionsCache = new Map<number, OptionSet>();

export function findOptionByLabel(
  optionSet: OptionSet | undefined | null,
  label: string | null | undefined,
): OptionEntry | null {
  if (!optionSet || !label) return null;
  return optionSet.map.get(normalizeLabel(label)) ?? null;
}

export async function fetchModelOptions(brandId: number): Promise<OptionSet | null> {
  if (!brandId) return null;
  if (modelOptionsCache.has(brandId)) return modelOptionsCache.get(brandId)!;
  const res = await fetch(`${CARS_BG_BASE_URL}/carmodelpublish.php?brandId=${brandId}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const parsed = parseOptionMap(html, 'modelId');
  modelOptionsCache.set(brandId, parsed);
  return parsed;
}

// ── Make/model inference ───────────────────────────────────────────────────

export function inferBrandFromTitle(title: string): OptionEntry | null {
  if (!optionSets?.brand) return null;
  const normalizedTitle = normalizeLabel(title);
  for (const option of optionSets.brand.sorted) {
    if (normalizedTitle.startsWith(option.normalized)) return option;
  }
  return null;
}

export function inferModelFromTitle(
  title: string,
  brandLabel: string,
  modelOptions: OptionSet | null,
): OptionEntry | null {
  if (!modelOptions) return null;
  const remainder = title.replace(new RegExp(`^${brandLabel}\\s*`, 'i'), '').trim();
  const normalized = normalizeLabel(remainder);
  for (const option of modelOptions.sorted) {
    if (normalized.startsWith(option.normalized)) return option;
  }
  return null;
}

// ── Field mapping ──────────────────────────────────────────────────────────

const CATEGORY_SYNONYMS: Record<string, string> = {
  стретч: 'Седан',
  stretch: 'Седан',
  лимузина: 'Седан',
  седан: 'Седан',
  suv: 'Джип',
  джип: 'Джип',
  комби: 'Комби',
  кабрио: 'Кабрио',
};

const COLOR_SYNONYMS = [
  { keywords: ['тъмно', 'тъмен', 'тъмна'], replacement: 'Черен' },
];

export function mapCategory(categoryName: string | null | undefined): OptionEntry | null {
  if (!optionSets?.category || !categoryName) return null;
  const direct = findOptionByLabel(optionSets.category, categoryName);
  if (direct) return direct;
  const synonym = CATEGORY_SYNONYMS[normalizeLabel(categoryName)];
  if (synonym) {
    const mapped = findOptionByLabel(optionSets.category, synonym);
    if (mapped) return mapped;
  }
  return optionSets.category.options.find((o) => normalizeLabel(categoryName).includes(o.normalized))
    ?? findOptionByLabel(optionSets.category, 'Седан');
}

function normalizeColorToken(token = ''): string {
  return normalizeLabel(token).replace(/t(?=[а-я])/g, 'т');
}

export function mapColor(colorName: string | null | undefined): OptionEntry | null {
  if (!optionSets?.color || !colorName) return null;
  const normalized = normalizeColorToken(colorName);
  const direct = optionSets.color.map.get(normalized);
  if (direct) return direct;
  const synonym = COLOR_SYNONYMS.find((entry) =>
    entry.keywords.some((word) => normalized.includes(normalizeColorToken(word))),
  );
  if (synonym) {
    const replacement = optionSets.color.map.get(normalizeColorToken(synonym.replacement));
    if (replacement) return replacement;
  }
  return optionSets.color.options.find((o) => normalized.includes(o.normalized)) ?? null;
}

export function mapFuel(fuelName: string | null | undefined): { id: number; label: string } | null {
  const normalized = normalizeLabel(fuelName || '');
  if (!normalized) return null;
  if (normalized.includes('диз')) return { id: 2, label: 'Дизел' };
  if (normalized.includes('бенз')) return { id: 1, label: 'Бензин' };
  if (normalized.includes('газ')) return { id: 3, label: 'Газ/Бензин' };
  if (normalized.includes('метан')) return { id: 4, label: 'Метан/Бензин' };
  if (normalized.includes('хибрид')) return { id: 6, label: 'Хибрид' };
  if (normalized.includes('елект')) return { id: 7, label: 'Електричество' };
  return null;
}

export function normalizeFuelFamily(fuelName: string | null | undefined): string | null {
  const normalized = normalizeLabel(fuelName || '');
  if (!normalized) return null;
  if (normalized.includes('plug in') || normalized.includes('плъг ин') || normalized.includes('plug-in')) return 'plug-in hybrid';
  if (normalized.includes('хибрид')) return 'hybrid';
  if (normalized.includes('диз')) return 'diesel';
  if (normalized.includes('бенз')) return 'petrol';
  if (normalized.includes('газ')) return 'gas';
  if (normalized.includes('метан')) return 'methane';
  if (normalized.includes('елект')) return 'electric';
  return normalized;
}

export function mapGear(transmission: string | null | undefined): { id: number; label: string } | null {
  const normalized = normalizeLabel(transmission || '');
  if (!normalized) return null;
  if (normalized.includes('автомат')) return { id: 2, label: 'Автоматични' };
  if (normalized.includes('ръч')) return { id: 1, label: 'Ръчни' };
  return null;
}

export function mapDoors(categoryName: string | null | undefined): number {
  const normalized = normalizeLabel(categoryName || '');
  return new Set(['купе', 'кабрио']).has(normalized) ? 1 : 2;
}

export function currencyIdFromCode(code = 'EUR'): number {
  const upper = code.toUpperCase();
  if (upper === 'BGN') return 1;
  if (upper === 'USD') return 2;
  return 3;
}
