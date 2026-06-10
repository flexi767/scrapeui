import { raw } from '@/db/client';
import { logger } from '@/lib/logger';
import {
  DEFAULT_SUB_LOCATION_OPTIONS,
  fetchSubLocationOptions,
  type SubLocationOptions,
} from '@/lib/mobile-bg/location-options';

const log = logger.child('search-prefill');

export interface ReferenceOption {
  value: string;
  count: number | null;
}

interface LabeledOption {
  value: string;
  label: string;
}

export const LOCATION_OPTIONS: LabeledOption[] = [
  { value: '', label: 'всички' },
  { value: 'България', label: 'България' },
  { value: 'Извън страната', label: 'Извън страната' },
  { value: 'Благоевград', label: 'обл. Благоевград' },
  { value: 'Бургас', label: 'обл. Бургас' },
  { value: 'Варна', label: 'обл. Варна' },
  { value: 'Велико Търново', label: 'обл. Велико Търново' },
  { value: 'Видин', label: 'обл. Видин' },
  { value: 'Враца', label: 'обл. Враца' },
  { value: 'Габрово', label: 'обл. Габрово' },
  { value: 'Добрич', label: 'обл. Добрич' },
  { value: 'Дупница', label: 'общ. Дупница' },
  { value: 'Кърджали', label: 'обл. Кърджали' },
  { value: 'Кюстендил', label: 'обл. Кюстендил' },
  { value: 'Ловеч', label: 'обл. Ловеч' },
  { value: 'Монтана', label: 'обл. Монтана' },
  { value: 'Пазарджик', label: 'обл. Пазарджик' },
  { value: 'Перник', label: 'обл. Перник' },
  { value: 'Плевен', label: 'обл. Плевен' },
  { value: 'Пловдив', label: 'обл. Пловдив' },
  { value: 'Разград', label: 'обл. Разград' },
  { value: 'Русе', label: 'обл. Русе' },
  { value: 'Силистра', label: 'обл. Силистра' },
  { value: 'Сливен', label: 'обл. Сливен' },
  { value: 'Смолян', label: 'обл. Смолян' },
  { value: 'София', label: 'обл. София' },
  { value: 'Стара Загора', label: 'обл. Стара Загора' },
  { value: 'Търговище', label: 'обл. Търговище' },
  { value: 'Хасково', label: 'обл. Хасково' },
  { value: 'Шумен', label: 'обл. Шумен' },
  { value: 'Ямбол', label: 'обл. Ямбол' },
];

export async function loadSubLocationOptions(
  location: string,
  includeLocationOptions: boolean,
): Promise<SubLocationOptions> {
  if (!includeLocationOptions) return DEFAULT_SUB_LOCATION_OPTIONS;

  try {
    return await fetchSubLocationOptions(location);
  } catch (error) {
    log.warn(
      `Falling back to default sub-location options for "${location}":`,
      error,
    );
    return DEFAULT_SUB_LOCATION_OPTIONS;
  }
}

export async function loadMakeModelOptions() {
  const makeOptions = raw
    .prepare(
      `
    SELECT make as value, make_count as count
    FROM mobilebg_make_models
    WHERE model = ''
    ORDER BY make
  `,
    )
    .all() as ReferenceOption[];

  const modelRows = raw
    .prepare(
      `
    SELECT make, model as value, model_count as count
    FROM mobilebg_make_models
    WHERE model != ''
    ORDER BY make, model
  `,
    )
    .all() as Array<ReferenceOption & { make: string }>;

  const modelsByMake = modelRows.reduce<Record<string, ReferenceOption[]>>(
    (acc, row) => {
      if (!acc[row.make]) acc[row.make] = [];
      acc[row.make].push({ value: row.value, count: row.count });
      return acc;
    },
    {},
  );

  return { makeOptions, modelsByMake };
}

