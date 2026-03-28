/**
 * Fetches canonical fuel types from mobile.bg's homepage engine_type select.
 */

import { USER_AGENT } from './constants';

let _fuelMap: Map<string, string> | null = null;

async function fetchWin1251(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new TextDecoder('windows-1251').decode(buf);
}

export async function fetchFuelTypes(): Promise<Map<string, string>> {
  if (_fuelMap) return _fuelMap;

  const html = await fetchWin1251('https://www.mobile.bg');
  const selectMatch = html.match(/name="engine_type"[^>]*>([\s\S]*?)<\/select>/);
  if (!selectMatch) throw new Error('Could not find engine_type select on mobile.bg');

  const map = new Map<string, string>();
  const optionRegex = /<option\s+value="([^"]+)"[^>]*>\s*([^<\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = optionRegex.exec(selectMatch[1])) !== null) {
    const value = m[1].trim();
    if (value) map.set(value.toLowerCase(), value);
  }

  _fuelMap = map;
  return map;
}

export function normalizeFuelSync(rawFuel: string | null | undefined, map: Map<string, string> | null): string | null {
  if (!rawFuel || !map) return rawFuel ?? null;
  const text = String(rawFuel).trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  if (map.has(lower)) return map.get(lower)!;
  for (const [key, canonical] of map) {
    if (lower.includes(key) || key.includes(lower)) return canonical;
  }
  return text;
}
