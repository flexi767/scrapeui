/**
 * Fetches canonical fuel types from mobile.bg's homepage engine_type select.
 */

import { fetchWin1251, normalizeFromSelectMap, parseSelectOptionMap } from './fetch-html';

let _fuelMap: Map<string, string> | null = null;

export async function fetchFuelTypes(): Promise<Map<string, string>> {
  if (_fuelMap) return _fuelMap;

  const html = await fetchWin1251('https://www.mobile.bg');
  const selectMatch = html.match(/name="engine_type"[^>]*>([\s\S]*?)<\/select>/);
  if (!selectMatch) throw new Error('Could not find engine_type select on mobile.bg');

  _fuelMap = parseSelectOptionMap(selectMatch[1]);
  return _fuelMap;
}

export function normalizeFuelSync(rawFuel: string | null | undefined, map: Map<string, string> | null): string | null {
  return normalizeFromSelectMap(rawFuel, map);
}
