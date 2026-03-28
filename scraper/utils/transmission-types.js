/**
 * Fetches canonical transmission types from mobile.bg's homepage transmission select.
 * Returns a Map: lowercase text → canonical transmission string
 */
/* eslint-disable @typescript-eslint/no-require-imports */

const { execSync } = require('child_process');
const { USER_AGENT } = require('./constants');

let _transmissionMap = null; // cached after first load

async function fetchTransmissionTypes() {
  if (_transmissionMap) return _transmissionMap;

  const html = execSync(
    `curl -s -A "${USER_AGENT}" "https://www.mobile.bg" | iconv -f windows-1251 -t utf-8`,
    { encoding: 'utf-8', timeout: 15000 }
  );

  const selectMatch = html.match(/name="transmission"[^>]*>([\s\S]*?)<\/select>/);
  if (!selectMatch) throw new Error('Could not find transmission select on mobile.bg');

  const map = new Map();
  const optionRegex = /<option\s+value="([^"]+)"[^>]*>\s*([^<\n]+)/g;
  let m;
  while ((m = optionRegex.exec(selectMatch[1])) !== null) {
    const value = m[1].trim();
    if (value) {
      map.set(value.toLowerCase(), value);
    }
  }

  _transmissionMap = map;
  return map;
}

function normalizeTransmissionSync(rawTransmission, map) {
  if (!rawTransmission || !map) return rawTransmission || null;
  const text = String(rawTransmission).trim();
  if (!text) return null;

  const lower = text.toLowerCase();
  if (map.has(lower)) return map.get(lower);

  for (const [key, canonical] of map) {
    if (lower.includes(key) || key.includes(lower)) return canonical;
  }

  return text;
}

async function normalizeTransmission(rawTransmission) {
  if (!rawTransmission) return null;
  const map = await fetchTransmissionTypes();
  return normalizeTransmissionSync(rawTransmission, map);
}

module.exports = { fetchTransmissionTypes, normalizeTransmission, normalizeTransmissionSync };
