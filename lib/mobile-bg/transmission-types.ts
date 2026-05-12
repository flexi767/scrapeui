/**
 * Fetches canonical transmission types from mobile.bg's homepage transmission select.
 */

import { fetchWin1251, normalizeFromSelectMap, parseSelectOptionMap } from './fetch-html';

let _transmissionMap: Map<string, string> | null = null;

export async function fetchTransmissionTypes(): Promise<Map<string, string>> {
  if (_transmissionMap) return _transmissionMap;

  const html = await fetchWin1251('https://www.mobile.bg');
  const selectMatch = html.match(/name="transmission"[^>]*>([\s\S]*?)<\/select>/);
  if (!selectMatch) throw new Error('Could not find transmission select on mobile.bg');

  _transmissionMap = parseSelectOptionMap(selectMatch[1]);
  return _transmissionMap;
}

export function normalizeTransmissionSync(rawTransmission: string | null | undefined, map: Map<string, string> | null): string | null {
  return normalizeFromSelectMap(rawTransmission, map);
}
