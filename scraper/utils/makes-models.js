/**
 * Fetches all makes and models from mobile.bg's cmmvars.js.
 * Returns a Map: make (string) → { make, makeId, models: [{ label, id }] }
 * Also exports parseMakeModel(title) using the authoritative list.
 */
/* eslint-disable @typescript-eslint/no-require-imports */

const { execSync } = require('child_process');
const { USER_AGENT } = require('./constants');

let _makesMap = null; // cached after first load

async function fetchMakesModels() {
  if (_makesMap) return _makesMap;

  // Fetch cmmvars.js — find the version hash from the publish page first
  let cmmUrl = 'https://www.mobile.bg/jss/cmmvars.js';
  try {
    const html = execSync(
      `curl -s -A "${USER_AGENT}" "https://www.mobile.bg/pcgi/mobile.cgi?pubtype=1&act=6&subact=4&actions=1"`,
      { encoding: 'utf-8', timeout: 15000 }
    );
    const match = html.match(/\/jss\/cmmvars\.js\?[\d]+/);
    if (match) cmmUrl = 'https://www.mobile.bg' + match[0];
  } catch { /* fall back to base URL */ }

  // File is Windows-1251 encoded — convert to UTF-8 via iconv
  const js = execSync(
    `curl -s -A "${USER_AGENT}" "${cmmUrl}" | iconv -f windows-1251 -t utf-8`,
    { encoding: 'utf-8', timeout: 15000 }
  );

  // Extract the cmm array block
  const cmmMatch = js.match(/var cmm\s*=\s*new Array\s*\(([\s\S]*?)\)\s*;/);
  if (!cmmMatch) throw new Error('Could not find cmm array in cmmvars.js');

  const map = new Map();
  const block = cmmMatch[1];

  // Each row looks roughly like:
  // ['Make','<makeId>','Model1','<modelId1>','Model2','<modelId2>', ...]
  const rowRegex = /\[\s*'([^']+)'\s*,\s*'([^']*)'((?:\s*,\s*'[^']*')*)\s*\]/g;
  let m;
  while ((m = rowRegex.exec(block)) !== null) {
    const make = m[1].trim();
    const makeIdRaw = m[2].trim();
    const tokens = [...m[3].matchAll(/'([^']*)'/g)].map(x => x[1].trim());
    const models = [];
    for (let i = 0; i < tokens.length; i += 2) {
      const label = tokens[i] || '';
      const idRaw = tokens[i + 1] || '';
      if (!label || /^\d+$/.test(label)) continue;
      models.push({ label, id: idRaw ? Number(idRaw) || null : null });
    }
    if (make && make.length < 50) {
      const key = make.toLowerCase();
      const makeId = makeIdRaw ? Number(makeIdRaw) || null : null;
      if (map.has(key)) {
        const existing = map.get(key);
        const mergedByLabel = new Map(existing.models.map(x => [x.label.toLowerCase(), x]));
        for (const model of models) {
          if (!mergedByLabel.has(model.label.toLowerCase())) {
            mergedByLabel.set(model.label.toLowerCase(), model);
          }
        }
        map.set(key, {
          make: existing.make,
          makeId: existing.makeId ?? makeId,
          models: [...mergedByLabel.values()],
        });
      } else {
        map.set(key, { make, makeId, models });
      }
    }
  }

  _makesMap = map;
  return map;
}

/**
 * Parse make and model from a listing title using the authoritative mobile.bg list.
 * Falls back gracefully for unknown makes.
 */
async function parseMakeModel(title) {
  if (!title) return { make: '', model: '' };
  const map = await fetchMakesModels();
  const titleLower = title.toLowerCase().trim();

  // Try longest matching make first (catches "Land Rover", "Alfa Romeo", etc.)
  const sortedMakes = [...map.keys()].sort((a, b) => b.length - a.length);
  for (const makeLower of sortedMakes) {
    if (titleLower.startsWith(makeLower)) {
      const { make, makeId, models } = map.get(makeLower);
      const rest = title.slice(make.length).trim();
      const modelsSorted = [...models].sort((a, b) => b.label.length - a.label.length);
      for (const model of modelsSorted) {
        if (rest.toLowerCase().startsWith(model.label.toLowerCase())) {
          return { make, model: model.label, mobileMakeId: makeId, mobileModelId: model.id };
        }
      }
      return { make, model: rest.split(/\s+/)[0] || '', mobileMakeId: makeId, mobileModelId: null };
    }
  }

  // Unknown make — best-effort split
  const parts = title.trim().split(/\s+/);
  return { make: parts[0] || '', model: parts[1] || '', mobileMakeId: null, mobileModelId: null };
}

/**
 * Synchronous version — requires map to already be loaded via fetchMakesModels().
 */
function parseMakeModelSync(title, map) {
  if (!title || !map) return { make: '', model: '' };
  const titleLower = title.toLowerCase().trim();
  const sortedMakes = [...map.keys()].sort((a, b) => b.length - a.length);
  for (const makeLower of sortedMakes) {
    if (titleLower.startsWith(makeLower)) {
      const { make, makeId, models } = map.get(makeLower);
      const rest = title.slice(make.length).trim();
      const modelsSorted = [...models].sort((a, b) => b.label.length - a.label.length);
      for (const model of modelsSorted) {
        if (rest.toLowerCase().startsWith(model.label.toLowerCase())) {
          return { make, model: model.label, mobileMakeId: makeId, mobileModelId: model.id };
        }
      }
      return { make, model: rest.split(/\s+/)[0] || '', mobileMakeId: makeId, mobileModelId: null };
    }
  }
  const parts = title.trim().split(/\s+/);
  return { make: parts[0] || '', model: parts[1] || '', mobileMakeId: null, mobileModelId: null };
}

module.exports = { fetchMakesModels, parseMakeModel, parseMakeModelSync };
