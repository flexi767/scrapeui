/**
 * Fetches canonical fuel types from mobile.bg's homepage engine_type select.
 * Returns a Map: lowercase fuel text → canonical fuel string
 * Also exports normalizeFuel(text) using the authoritative list.
 */
/* eslint-disable @typescript-eslint/no-require-imports */

const { execSync } = require('child_process');
const { USER_AGENT } = require('./constants');

let _fuelMap = null; // cached after first load

async function fetchFuelTypes() {
  if (_fuelMap) return _fuelMap;

  const html = execSync(
    `curl -s -A "${USER_AGENT}" "https://www.mobile.bg" | iconv -f windows-1251 -t utf-8`,
    { encoding: 'utf-8', timeout: 15000 }
  );

  // Parse engine_type select options
  const selectMatch = html.match(/name="engine_type"[^>]*>([\s\S]*?)<\/select>/);
  if (!selectMatch) throw new Error('Could not find engine_type select on mobile.bg');

  const map = new Map();
  const optionRegex = /<option\s+value="([^"]+)"[^>]*>\s*([^<\n]+)/g;
  let m;
  while ((m = optionRegex.exec(selectMatch[1])) !== null) {
    const value = m[1].trim();
    if (value) {
      map.set(value.toLowerCase(), value);
    }
  }

  _fuelMap = map;
  return map;
}

/**
 * Normalize a scraped fuel string against the authoritative mobile.bg list.
 * Returns the canonical value if matched, or the original trimmed string.
 */
function normalizeFuelSync(rawFuel, map) {
  if (!rawFuel || !map) return rawFuel || null;
  const text = String(rawFuel).trim();
  if (!text) return null;

  // Exact match (case-insensitive)
  const lower = text.toLowerCase();
  if (map.has(lower)) return map.get(lower);

  // Partial match — canonical value is contained in scraped text or vice versa
  for (const [key, canonical] of map) {
    if (lower.includes(key) || key.includes(lower)) return canonical;
  }

  return text;
}

async function normalizeFuel(rawFuel) {
  if (!rawFuel) return null;
  const map = await fetchFuelTypes();
  return normalizeFuelSync(rawFuel, map);
}

module.exports = { fetchFuelTypes, normalizeFuel, normalizeFuelSync };
