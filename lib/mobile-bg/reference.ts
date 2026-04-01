import type Database from 'better-sqlite3';
import { USER_AGENT } from './constants';
import { fetchMakesModels, normalizeMakeModelLabel, type MakeEntry, type MakesMap, type ModelEntry } from './makes-models';

export const DEFAULT_MOBILEBG_SEARCH_PATH = '/search/avtomobili-dzhipove';
export const DEFAULT_MOBILEBG_PUBTYPE = '1,2';

export interface MobileBgMakeModelReferenceRow {
  make: string;
  model: string;
  makeId: number | null;
  modelId: number | null;
  makeCount: number | null;
  modelCount: number | null;
}

export interface MobileBgMakeModelSyncOptions {
  searchPath?: string;
  pubtype?: string;
  onlyMake?: string | null;
  onProgress?: ((event: MobileBgMakeModelSyncProgressEvent) => void) | null;
}

export interface MobileBgMakeModelSyncResult {
  makesProcessed: number;
  modelsProcessed: number;
  makeCountsFound: number;
  modelCountsFound: number;
}

export interface MobileBgMakeModelSyncProgressEvent {
  type: 'status' | 'make';
  message: string;
  make?: string;
  current?: number;
  total?: number;
  modelsProcessed?: number;
  makeCount?: number | null;
  modelCountsFound?: number;
}

function compareModelEntries(a: ModelEntry, b: ModelEntry): number {
  return b.label.length - a.label.length || (b.count ?? -1) - (a.count ?? -1) || a.label.localeCompare(b.label, 'bg');
}

function compareMakeEntries(a: MakeEntry, b: MakeEntry): number {
  return b.make.length - a.make.length || (b.count ?? -1) - (a.count ?? -1) || a.make.localeCompare(b.make, 'bg');
}

async function fetchWin1251(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new TextDecoder('windows-1251').decode(buf);
}

function buildSearchUrl(searchPath: string, params: Record<string, string>): string {
  const url = new URL(searchPath, 'https://www.mobile.bg');
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

function parseCount(value: string): number | null {
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMakeCountsFromHtml(html: string): Map<string, number> {
  const counts = new Map<string, number>();
  const sectionMatch = html.match(/id="akSearchMarki"[\s\S]*?<div class="scroll">([\s\S]*?)<\/div>\s*<\/div>/i);
  const block = sectionMatch?.[1] ?? html;
  const rowRegex = /<div class="a"[\s\S]*?<span>([^<]+)<\/span>\s*<span>([^<]*)<\/span>[\s\S]*?<\/div>/gi;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(block)) !== null) {
    const make = match[1].trim();
    const count = parseCount(match[2]);
    if (!make || count === null) continue;
    counts.set(normalizeMakeModelLabel(make), count);
  }
  return counts;
}

function parseModelCountsFromHtml(html: string): Map<string, number> {
  const counts = new Map<string, number>();
  const sectionMatch = html.match(/id="akSearchModeli"[\s\S]*?<div class="scroll">([\s\S]*?)<\/div>\s*<a class="addButton"/i);
  const block = sectionMatch?.[1] ?? html;
  const labelRegex = /<label>[\s\S]*?<input[^>]*data-value="([^"]+)"[\s\S]*?<span[^>]*>(.*?)<\/span>\s*<span>([^<]*)<\/span>[\s\S]*?<\/label>/gi;
  let match: RegExpExecArray | null;
  while ((match = labelRegex.exec(block)) !== null) {
    const label = match[2].replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '').trim();
    const count = parseCount(match[3]);
    if (!label || count === null) continue;
    counts.set(normalizeMakeModelLabel(label), count);
  }
  return counts;
}

function buildMakesMapFromRows(rows: MobileBgMakeModelReferenceRow[]): MakesMap {
  const map: MakesMap = new Map();
  for (const row of rows) {
    const makeKey = normalizeMakeModelLabel(row.make);
    if (!makeKey) continue;

    let entry = map.get(makeKey);
    if (!entry) {
      entry = {
        make: row.make,
        makeId: row.makeId,
        count: row.makeCount,
        models: [],
      };
      map.set(makeKey, entry);
    } else {
      entry.makeId = entry.makeId ?? row.makeId;
      entry.count = entry.count ?? row.makeCount;
    }

    if (!row.model) continue;

    entry.models.push({
      label: row.model,
      id: row.modelId,
      count: row.modelCount,
    });
  }

  for (const entry of map.values()) {
    const deduped = new Map<string, ModelEntry>();
    for (const model of entry.models) {
      const key = normalizeMakeModelLabel(model.label);
      const current = deduped.get(key);
      if (!current) {
        deduped.set(key, model);
        continue;
      }
      deduped.set(key, {
        label: current.label.length >= model.label.length ? current.label : model.label,
        id: current.id ?? model.id,
        count: current.count ?? model.count,
      });
    }
    entry.models = [...deduped.values()].sort(compareModelEntries);
  }

  return new Map([...map.entries()].sort(([, a], [, b]) => compareMakeEntries(a, b)));
}

export function loadMobileBgMakesMapFromDb(
  db: Database.Database,
  { searchPath = DEFAULT_MOBILEBG_SEARCH_PATH, pubtype = DEFAULT_MOBILEBG_PUBTYPE }: MobileBgMakeModelSyncOptions = {},
): MakesMap | null {
  const rows = db.prepare(`
    SELECT make, model, make_id as makeId, model_id as modelId, make_count as makeCount, model_count as modelCount
    FROM mobilebg_make_models
    WHERE search_path = ? AND pubtype = ?
    ORDER BY make, model
  `).all(searchPath, pubtype) as MobileBgMakeModelReferenceRow[];

  if (rows.length === 0) return null;
  return buildMakesMapFromRows(rows);
}

function replaceReferenceRows(
  db: Database.Database,
  rows: MobileBgMakeModelReferenceRow[],
  { searchPath = DEFAULT_MOBILEBG_SEARCH_PATH, pubtype = DEFAULT_MOBILEBG_PUBTYPE, onlyMake = null }: MobileBgMakeModelSyncOptions = {},
) {
  const now = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO mobilebg_make_models (
      search_path, pubtype, make, model, make_id, model_id, make_count, model_count, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(search_path, pubtype, make, model) DO UPDATE SET
      make_id = excluded.make_id,
      model_id = excluded.model_id,
      make_count = excluded.make_count,
      model_count = excluded.model_count,
      updated_at = excluded.updated_at
  `);

  const runMany = db.transaction((entries: MobileBgMakeModelReferenceRow[]) => {
    if (onlyMake) {
      const make = entries[0]?.make ?? onlyMake;
      db.prepare(`
        DELETE FROM mobilebg_make_models
        WHERE search_path = ? AND pubtype = ? AND make = ?
      `).run(searchPath, pubtype, make);
    } else {
      db.prepare(`
        DELETE FROM mobilebg_make_models
        WHERE search_path = ? AND pubtype = ?
      `).run(searchPath, pubtype);
    }

    for (const row of entries) {
      upsert.run(
        searchPath,
        pubtype,
        row.make,
        row.model,
        row.makeId,
        row.modelId,
        row.makeCount,
        row.modelCount,
        now,
      );
    }
  });

  runMany(rows);
}

export async function syncMobileBgMakeModelReference(
  db: Database.Database,
  { searchPath = DEFAULT_MOBILEBG_SEARCH_PATH, pubtype = DEFAULT_MOBILEBG_PUBTYPE, onlyMake = null, onProgress = null }: MobileBgMakeModelSyncOptions = {},
): Promise<MobileBgMakeModelSyncResult> {
  const makesMap = await fetchMakesModels(pubtype);
  const normalizedOnlyMake = onlyMake ? normalizeMakeModelLabel(onlyMake) : null;
  onProgress?.({
    type: 'status',
    message: `Loading mobile.bg counts for ${normalizedOnlyMake ? onlyMake : 'all makes'}`,
  });
  const makeCountsHtml = await fetchWin1251(buildSearchUrl(searchPath, {}));
  const makeCounts = parseMakeCountsFromHtml(makeCountsHtml);

  const selectedMakes = [...makesMap.values()]
    .filter((entry) => !normalizedOnlyMake || normalizeMakeModelLabel(entry.make) === normalizedOnlyMake)
    .sort((a, b) => a.make.localeCompare(b.make, 'bg'));

  if (selectedMakes.length === 0) {
    throw new Error(normalizedOnlyMake
      ? `No mobile.bg make found for "${onlyMake}"`
      : 'No mobile.bg makes available for sync');
  }

  const rows: MobileBgMakeModelReferenceRow[] = [];
  let makeCountsFound = 0;
  let modelCountsFound = 0;

  for (const [index, makeEntry] of selectedMakes.entries()) {
    const normalizedMake = normalizeMakeModelLabel(makeEntry.make);
    const makeCount = makeCounts.get(normalizedMake) ?? null;
    if (makeCount !== null) makeCountsFound += 1;

    rows.push({
      make: makeEntry.make,
      model: '',
      makeId: makeEntry.makeId,
      modelId: null,
      makeCount,
      modelCount: null,
    });

    const modelCountsHtml = await fetchWin1251(buildSearchUrl(searchPath, { marka: makeEntry.make }));
    const modelCounts = parseModelCountsFromHtml(modelCountsHtml);
    let makeModelCountsFound = 0;

    for (const modelEntry of makeEntry.models) {
      const modelCount = modelCounts.get(normalizeMakeModelLabel(modelEntry.label)) ?? null;
      if (modelCount !== null) {
        modelCountsFound += 1;
        makeModelCountsFound += 1;
      }

      rows.push({
        make: makeEntry.make,
        model: modelEntry.label,
        makeId: makeEntry.makeId,
        modelId: modelEntry.id,
        makeCount,
        modelCount,
      });
    }

    onProgress?.({
      type: 'make',
      message: `Synced ${makeEntry.make}`,
      make: makeEntry.make,
      current: index + 1,
      total: selectedMakes.length,
      modelsProcessed: makeEntry.models.length,
      makeCount,
      modelCountsFound: makeModelCountsFound,
    });
  }

  onProgress?.({
    type: 'status',
    message: `Writing ${rows.length.toLocaleString('en-US')} reference rows to the database`,
  });
  replaceReferenceRows(db, rows, { searchPath, pubtype, onlyMake });

  return {
    makesProcessed: selectedMakes.length,
    modelsProcessed: rows.filter((row) => row.model !== '').length,
    makeCountsFound,
    modelCountsFound,
  };
}
