/**
 * Fetches canonical transmission types from mobile.bg's homepage transmission select.
 */

import { fetchWin1251, normalizeFromSelectMap } from './fetch-html';

let _transmissionMap: Map<string, string> | null = null;

export async function fetchTransmissionTypes(): Promise<Map<string, string>> {
  if (_transmissionMap) return _transmissionMap;

  const html = await fetchWin1251('https://www.mobile.bg');
  const selectMatch = html.match(/name="transmission"[^>]*>([\s\S]*?)<\/select>/);
  if (!selectMatch) throw new Error('Could not find transmission select on mobile.bg');

  const map = new Map<string, string>();
  const optionRegex = /<option\s+value="([^"]+)"[^>]*>\s*([^<\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = optionRegex.exec(selectMatch[1])) !== null) {
    const value = m[1].trim();
    if (value) map.set(value.toLowerCase(), value);
  }

  _transmissionMap = map;
  return map;
}

export function normalizeTransmissionSync(rawTransmission: string | null | undefined, map: Map<string, string> | null): string | null {
  return normalizeFromSelectMap(rawTransmission, map);
}
