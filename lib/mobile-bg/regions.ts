/**
 * Bulgarian regions (oblasts) and cities for the mobile.bg publish form.
 * Regions are parsed from the mobile.bg homepage search form.
 * Cities are fetched on-demand for a selected region.
 */

import { fetchWin1251 } from './fetch-html';

export interface Region { value: string; label: string; }
export interface City  { value: string; label: string; }

let _regions: Region[] | null = null;

function parseSelect(html: string, ...names: string[]): { value: string; label: string }[] {
  for (const name of names) {
    const m = html.match(new RegExp(`name="${name}"[^>]*>([\\s\\S]*?)<\\/select>`));
    if (!m) continue;
    const opts: { value: string; label: string }[] = [];
    const re = /<option[^>]+value="([^"]*)"[^>]*>([^<]+)/g;
    let hit: RegExpExecArray | null;
    while ((hit = re.exec(m[1])) !== null) {
      const value = hit[1].trim();
      const label = hit[2].trim();
      if (value && value !== '0') opts.push({ value, label });
    }
    if (opts.length > 3) return opts;
  }
  return [];
}

export async function fetchRegions(): Promise<Region[]> {
  if (_regions) return _regions;
  try {
    const html = await fetchWin1251('https://www.mobile.bg', { cache: 'no-store' });
    const parsed = parseSelect(html, 'sregion', 'region', 'f18');
    if (parsed.length >= 10) { _regions = parsed; return parsed; }
  } catch { /* fall through */ }
  _regions = FALLBACK_REGIONS;
  return _regions;
}

export async function fetchCitiesForRegion(regionValue: string): Promise<City[]> {
  const html = await fetchWin1251(
    `https://www.mobile.bg/pcgi/mobile.cgi?act=3&stype=1&f1=&f2=&sregion=${encodeURIComponent(regionValue)}`,
    { cache: 'no-store' },
  );
  return parseSelect(html, 'scity', 'city', 'f19');
}

// Fallback: 28 Bulgarian oblasts (values are best-effort; real IDs come from the live parse)
const FALLBACK_REGIONS: Region[] = [
  { value: '1',  label: 'Благоевград'     },
  { value: '2',  label: 'Бургас'          },
  { value: '3',  label: 'Варна'           },
  { value: '4',  label: 'Велико Търново'  },
  { value: '5',  label: 'Видин'           },
  { value: '6',  label: 'Враца'           },
  { value: '7',  label: 'Габрово'         },
  { value: '8',  label: 'Добрич'          },
  { value: '9',  label: 'Кърджали'        },
  { value: '10', label: 'Кюстендил'       },
  { value: '11', label: 'Ловеч'           },
  { value: '12', label: 'Монтана'         },
  { value: '13', label: 'Пазарджик'       },
  { value: '14', label: 'Перник'          },
  { value: '15', label: 'Плевен'          },
  { value: '16', label: 'Пловдив'         },
  { value: '17', label: 'Разград'         },
  { value: '18', label: 'Русе'            },
  { value: '19', label: 'Силистра'        },
  { value: '20', label: 'Сливен'          },
  { value: '21', label: 'Смолян'          },
  { value: '22', label: 'София (град)'    },
  { value: '23', label: 'София (област)'  },
  { value: '24', label: 'Стара Загора'    },
  { value: '25', label: 'Търговище'       },
  { value: '26', label: 'Хасково'         },
  { value: '27', label: 'Шумен'           },
  { value: '28', label: 'Ямбол'           },
];
