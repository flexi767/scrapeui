export const EXTRA_SECTIONS = [
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

const EXTRAS_CATEGORY_MAP: Record<string, string> = Object.fromEntries(
  EXTRA_SECTIONS.flatMap(({ category, items }) =>
    items.map((item) => [item, category]),
  ),
);

export function getExtraLabels(extrasJson: string | null): string[] {
  if (!extrasJson) return [];
  try {
    const parsed = JSON.parse(extrasJson) as Record<string, unknown>;
    return Object.values(parsed).flatMap((entry) => {
      if (!Array.isArray(entry)) return [];
      return entry.flatMap((item) => {
        if (typeof item === 'string') return [item];
        if (item && typeof item === 'object' && 'label' in item && typeof item.label === 'string') return [item.label];
        return [];
      });
    });
  } catch {
    return [];
  }
}

export function normalizeExtras(raw: unknown): Record<string, string[]> {
  if (!raw) return {};

  // Flat string array (from listings.extras_json) — categorize each item
  if (Array.isArray(raw)) {
    const result: Record<string, string[]> = {};
    for (const item of raw) {
      if (typeof item !== 'string') continue;
      const cat = EXTRAS_CATEGORY_MAP[item];
      if (!cat) continue;
      (result[cat] ??= []).push(item);
    }
    return result;
  }

  // Categorized object (from mobilebg_backups.extras_json)
  // Values may be {label, alias}[] objects or plain strings
  if (typeof raw === 'object' && raw !== null) {
    const result: Record<string, string[]> = {};
    for (const [cat, items] of Object.entries(raw as Record<string, unknown>)) {
      if (!Array.isArray(items)) continue;
      result[cat] = items
        .map((item) => {
          if (typeof item === 'string') return item;
          if (typeof item === 'object' && item !== null && 'label' in item) {
            return (item as { label: string }).label;
          }
          return '';
        })
        .filter(Boolean);
    }
    return result;
  }

  return {};
}
