/**
 * Canonical car body types as used by mobile.bg (Категория field).
 * Not available as a static select on mobile.bg, so the list is hardcoded.
 */

export const CANONICAL_BODY_TYPES = [
  'Седан', 'Хечбек', 'Комби', 'Купе', 'Кабриолет',
  'Джип', 'Пикап', 'Ван', 'Минибус', 'Лифтбек', 'Родстер', 'Фургон',
] as const;

let _bodyTypeMap: Map<string, string> | null = null;

export function getBodyTypeMap(): Map<string, string> {
  if (_bodyTypeMap) return _bodyTypeMap;
  const map = new Map<string, string>();
  for (const value of CANONICAL_BODY_TYPES) map.set(value.toLowerCase(), value);
  _bodyTypeMap = map;
  return map;
}

export function normalizeBodyTypeSync(rawBodyType: string | null | undefined, map?: Map<string, string> | null): string | null {
  if (!rawBodyType) return null;
  const text = String(rawBodyType).trim();
  if (!text) return null;
  const m = map ?? getBodyTypeMap();
  const lower = text.toLowerCase();
  if (m.has(lower)) return m.get(lower)!;
  for (const [key, canonical] of m) {
    if (lower.includes(key) || key.includes(lower)) return canonical;
  }
  return text;
}
