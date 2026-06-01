import { parseJson } from '@/lib/utils';
import { normalizeLabel } from '@/lib/cars-bg/sync-text';

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

export function parseCarsBgExtrasPayload(extrasJson: string | null): CarsBgExtrasPayload | null {
  const parsed = parseJson<CarsBgExtrasPayload | null>(extrasJson, null);
  if (!parsed || !Array.isArray(parsed.selected)) return null;
  return parsed;
}
