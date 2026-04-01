/**
 * Fetches all makes and models from mobile.bg's cmmvars.js.
 * Returns a Map: make (string) → { make, makeId, models: [{ label, id }] }
 */

import { USER_AGENT } from './constants';

export interface ModelEntry { label: string; id: number | null; count?: number | null }
export interface MakeEntry { make: string; makeId: number | null; count?: number | null; models: ModelEntry[] }
export type MakesMap = Map<string, MakeEntry>;

// Cache per pubtype
const _cache = new Map<string, MakesMap>();

export function normalizeMakeModelLabel(value = ''): string {
  return String(value).toLowerCase().replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

async function fetchWin1251(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new TextDecoder('windows-1251').decode(buf);
}

// Raw (unfiltered) parse — cached independently
let _rawJs: string | null = null;

async function fetchCmmVarsJs(): Promise<string> {
  if (_rawJs) return _rawJs;
  let cmmUrl = 'https://www.mobile.bg/jss/cmmvars.js';
  try {
    const html = await fetchWin1251(
      'https://www.mobile.bg/pcgi/mobile.cgi?pubtype=1&act=6&subact=4&actions=1'
    );
    const match = html.match(/\/jss\/cmmvars\.js\?[\d]+/);
    if (match) cmmUrl = 'https://www.mobile.bg' + match[0];
  } catch { /* fall back */ }
  _rawJs = await fetchWin1251(cmmUrl);
  return _rawJs;
}

function parseMm2pt(js: string): Map<string, string> {
  // mm2pt["Make~Model"]="pubtype"
  const map = new Map<string, string>();
  const re = /mm2pt\["([^"]+)"\]\s*=\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(js)) !== null) map.set(m[1], m[2]);
  return map;
}

// mm2pt only contains pubtypes '1' (cars) and '2' (SUVs/jeeps).
// Everything else in cmm (motorcycles, trucks…) is untagged and must be excluded.
function parseCmm(js: string, mm2pt: Map<string, string>, pubtypes: string[]): MakesMap {
  const ptSet = new Set(pubtypes);
  const cmmMatch = js.match(/var cmm\s*=\s*new Array\s*\(([\s\S]*?)\)\s*;/);
  if (!cmmMatch) throw new Error('Could not find cmm array in cmmvars.js');

  const map: MakesMap = new Map();
  const block = cmmMatch[1];
  const rowRegex = /\[\s*'([^']+)'\s*,\s*'([^']*)'((?:\s*,\s*'[^']*')*)\s*\]/g;
  let m: RegExpExecArray | null;

  while ((m = rowRegex.exec(block)) !== null) {
    const make = m[1].trim();
    if (!make || make.length >= 50) continue;

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

    // Only include models that are explicitly tagged in mm2pt for one of our pubtypes.
    // Untagged entries (motorcycles, trucks, etc.) are excluded entirely.
    const filtered = models.filter(model => {
      const mapped = mm2pt.get(`${make}~${model.label}`);
      return mapped !== undefined && ptSet.has(mapped);
    });

    if (filtered.length === 0) continue;

    const key = normalizeMakeModelLabel(make);
    const makeId = makeIdRaw ? Number(makeIdRaw) || null : null;
    if (map.has(key)) {
      const existing = map.get(key)!;
      const mergedByLabel = new Map(existing.models.map(x => [normalizeMakeModelLabel(x.label), x]));
      for (const model of filtered) {
        if (!mergedByLabel.has(normalizeMakeModelLabel(model.label))) mergedByLabel.set(normalizeMakeModelLabel(model.label), model);
      }
      map.set(key, { make: existing.make, makeId: existing.makeId ?? makeId, models: [...mergedByLabel.values()] });
    } else {
      map.set(key, { make, makeId, models: filtered });
    }
  }

  return map;
}

// pubtype can be a single value '1' or comma-separated '1,2'
export async function fetchMakesModels(pubtype = '1,2'): Promise<MakesMap> {
  if (_cache.has(pubtype)) return _cache.get(pubtype)!;
  const js = await fetchCmmVarsJs();
  const mm2pt = parseMm2pt(js);
  const pubtypes = pubtype.split(',').map(s => s.trim());
  const map = parseCmm(js, mm2pt, pubtypes);
  _cache.set(pubtype, map);
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
  const titleLower = normalizeMakeModelLabel(title);
  const sortedMakes = [...map.entries()]
    .sort(([, a], [, b]) => b.make.length - a.make.length || (b.count ?? -1) - (a.count ?? -1))
    .map(([key]) => key);
  for (const makeLower of sortedMakes) {
    if (titleLower.startsWith(makeLower)) {
      const { make, makeId, models } = map.get(makeLower)!;
      const rest = title.slice(make.length).trim();
      const modelsSorted = [...models].sort((a, b) => b.label.length - a.label.length || (b.count ?? -1) - (a.count ?? -1));
      for (const model of modelsSorted) {
        if (normalizeMakeModelLabel(rest).startsWith(normalizeMakeModelLabel(model.label))) {
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
