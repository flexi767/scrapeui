/**
 * Fetches all makes and models from mobile.bg's cmmvars.js.
 * Returns a Map: make (string) → models (string[])
 * Also exports parseMakeModel(title) using the authoritative list.
 */

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

  // Each row is like: ['Make','','Model1','Model2',...]
  // Split by lines and parse each array row
  const rowRegex = /\[\s*'([^']+)'(?:\s*,\s*'[^']*')?((?:\s*,\s*'[^']*')*)\s*\]/g;
  let m;
  while ((m = rowRegex.exec(block)) !== null) {
    const make = m[1].trim();
    const modelsBlock = m[2] || '';
    const models = [...modelsBlock.matchAll(/'([^']*)'/g)]
      .map(x => x[1].trim())
      .filter(s => s && !/^\d+$/.test(s)); // skip numeric IDs
    if (make && make.length < 50) {
      const key = make.toLowerCase();
      if (map.has(key)) {
        // Merge models from duplicate entries (e.g. Hyundai cars + trucks)
        const existing = map.get(key);
        const merged = [...new Set([...existing.models, ...models])];
        map.set(key, { make: existing.make, models: merged });
      } else {
        map.set(key, { make, models });
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
      const { make, models } = map.get(makeLower);
      const rest = title.slice(make.length).trim();
      // Try to match a model from the known list (longest first)
      const modelsSorted = [...models].sort((a, b) => b.length - a.length);
      for (const model of modelsSorted) {
        if (rest.toLowerCase().startsWith(model.toLowerCase())) {
          return { make, model };
        }
      }
      // No model matched — take first word of remainder
      return { make, model: rest.split(/\s+/)[0] || '' };
    }
  }

  // Unknown make — best-effort split
  const parts = title.trim().split(/\s+/);
  return { make: parts[0] || '', model: parts[1] || '' };
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
      const { make, models } = map.get(makeLower);
      const rest = title.slice(make.length).trim();
      const modelsSorted = [...models].sort((a, b) => b.length - a.length);
      for (const model of modelsSorted) {
        if (rest.toLowerCase().startsWith(model.toLowerCase())) {
          return { make, model };
        }
      }
      return { make, model: rest.split(/\s+/)[0] || '' };
    }
  }
  const parts = title.trim().split(/\s+/);
  return { make: parts[0] || '', model: parts[1] || '' };
}

module.exports = { fetchMakesModels, parseMakeModel, parseMakeModelSync };
