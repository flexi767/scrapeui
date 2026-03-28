/**
 * Canonical car body types as used by mobile.bg (Категория field).
 * Not available as a static select on mobile.bg, so the list is hardcoded.
 * Returns a Map: lowercase text → canonical body type string
 */

const CANONICAL_BODY_TYPES = [
  'Седан',
  'Хечбек',
  'Комби',
  'Купе',
  'Кабриолет',
  'Джип',
  'Пикап',
  'Ван',
  'Минибус',
  'Лифтбек',
  'Родстер',
  'Фургон',
];

let _bodyTypeMap = null;

function getBodyTypeMap() {
  if (_bodyTypeMap) return _bodyTypeMap;
  const map = new Map();
  for (const value of CANONICAL_BODY_TYPES) {
    map.set(value.toLowerCase(), value);
  }
  _bodyTypeMap = map;
  return map;
}

function normalizeBodyTypeSync(rawBodyType, map) {
  if (!rawBodyType) return null;
  const text = String(rawBodyType).trim();
  if (!text) return null;

  const m = map || getBodyTypeMap();
  const lower = text.toLowerCase();
  if (m.has(lower)) return m.get(lower);

  for (const [key, canonical] of m) {
    if (lower.includes(key) || key.includes(lower)) return canonical;
  }

  return text;
}

module.exports = { getBodyTypeMap, normalizeBodyTypeSync, CANONICAL_BODY_TYPES };
