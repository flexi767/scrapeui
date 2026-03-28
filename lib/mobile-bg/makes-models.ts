/**
 * Fetches all makes and models from mobile.bg's cmmvars.js.
 * Returns a Map: make (string) → { make, makeId, models: [{ label, id }] }
 */

import { USER_AGENT } from './constants';

export interface ModelEntry { label: string; id: number | null }
export interface MakeEntry { make: string; makeId: number | null; models: ModelEntry[] }
export type MakesMap = Map<string, MakeEntry>;

let _makesMap: MakesMap | null = null;

async function fetchWin1251(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new TextDecoder('windows-1251').decode(buf);
}

export async function fetchMakesModels(): Promise<MakesMap> {
  if (_makesMap) return _makesMap;

  // Find versioned cmmvars.js URL from the publish page
  let cmmUrl = 'https://www.mobile.bg/jss/cmmvars.js';
  try {
    const html = await fetchWin1251(
      'https://www.mobile.bg/pcgi/mobile.cgi?pubtype=1&act=6&subact=4&actions=1'
    );
    const match = html.match(/\/jss\/cmmvars\.js\?[\d]+/);
    if (match) cmmUrl = 'https://www.mobile.bg' + match[0];
  } catch { /* fall back to base URL */ }

  const js = await fetchWin1251(cmmUrl);

  const cmmMatch = js.match(/var cmm\s*=\s*new Array\s*\(([\s\S]*?)\)\s*;/);
  if (!cmmMatch) throw new Error('Could not find cmm array in cmmvars.js');

  const map: MakesMap = new Map();
  const block = cmmMatch[1];

  const rowRegex = /\[\s*'([^']+)'\s*,\s*'([^']*)'((?:\s*,\s*'[^']*')*)\s*\]/g;
  let m: RegExpExecArray | null;
  while ((m = rowRegex.exec(block)) !== null) {
    const make = m[1].trim();
    const makeIdRaw = m[2].trim();
    const tokens = [...m[3].matchAll(/'([^']*)'/g)].map(x => x[1].trim());
    const models: ModelEntry[] = [];
    for (let i = 0; i < tokens.length;) {
      const label = tokens[i] || '';
      if (!label || /^\d+$/.test(label)) { i += 1; continue; }
      const nextToken = tokens[i + 1] || '';
      const hasPairedId = /^\d+$/.test(nextToken);
      models.push({ label, id: hasPairedId ? Number(nextToken) || null : null });
      i += hasPairedId ? 2 : 1;
    }
    if (make && make.length < 50) {
      const key = make.toLowerCase();
      const makeId = makeIdRaw ? Number(makeIdRaw) || null : null;
      if (map.has(key)) {
        const existing = map.get(key)!;
        const mergedByLabel = new Map(existing.models.map(x => [x.label.toLowerCase(), x]));
        for (const model of models) {
          if (!mergedByLabel.has(model.label.toLowerCase())) mergedByLabel.set(model.label.toLowerCase(), model);
        }
        map.set(key, { make: existing.make, makeId: existing.makeId ?? makeId, models: [...mergedByLabel.values()] });
      } else {
        map.set(key, { make, makeId, models });
      }
    }
  }

  _makesMap = map;
  return map;
}

function stripParsedPrefix(title: string, make: string, model: string): string {
  const raw = String(title || '').trim();
  if (!raw) return '';
  const prefix = [make, model].filter(Boolean).join(' ').trim();
  if (!prefix) return raw;
  return raw.toLowerCase().startsWith(prefix.toLowerCase()) ? raw.slice(prefix.length).trim() : raw;
}

export interface ParsedMakeModel {
  make: string; model: string;
  mobileMakeId: number | null; mobileModelId: number | null;
  titleRemainder: string;
}

export function parseMakeModelSync(title: string, map: MakesMap | null): ParsedMakeModel {
  if (!title || !map) return { make: '', model: '', mobileMakeId: null, mobileModelId: null, titleRemainder: title || '' };
  const titleLower = title.toLowerCase().trim();
  const sortedMakes = [...map.keys()].sort((a, b) => b.length - a.length);
  for (const makeLower of sortedMakes) {
    if (titleLower.startsWith(makeLower)) {
      const { make, makeId, models } = map.get(makeLower)!;
      const rest = title.slice(make.length).trim();
      const modelsSorted = [...models].sort((a, b) => b.label.length - a.label.length);
      for (const model of modelsSorted) {
        if (rest.toLowerCase().startsWith(model.label.toLowerCase())) {
          return { make, model: model.label, mobileMakeId: makeId, mobileModelId: model.id, titleRemainder: stripParsedPrefix(title, make, model.label) };
        }
      }
      const fallbackModel = rest.split(/\s+/)[0] || '';
      return { make, model: fallbackModel, mobileMakeId: makeId, mobileModelId: null, titleRemainder: stripParsedPrefix(title, make, fallbackModel) };
    }
  }
  const parts = title.trim().split(/\s+/);
  const fallbackMake = parts[0] || '';
  const fallbackModel = parts[1] || '';
  return { make: fallbackMake, model: fallbackModel, mobileMakeId: null, mobileModelId: null, titleRemainder: stripParsedPrefix(title, fallbackMake, fallbackModel) };
}

export async function parseMakeModel(title: string): Promise<ParsedMakeModel> {
  if (!title) return { make: '', model: '', mobileMakeId: null, mobileModelId: null, titleRemainder: '' };
  const map = await fetchMakesModels();
  return parseMakeModelSync(title, map);
}
