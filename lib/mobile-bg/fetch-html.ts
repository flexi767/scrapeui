import { USER_AGENT } from './constants';

export async function fetchWin1251(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, ...init });
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new TextDecoder('windows-1251').decode(buf);
}

export function parseSelectOptionMap(selectInnerHtml: string): Map<string, string> {
  const map = new Map<string, string>();
  const optionRegex = /<option\s+value="([^"]+)"[^>]*>\s*([^<\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = optionRegex.exec(selectInnerHtml)) !== null) {
    const value = m[1].trim();
    if (value) map.set(value.toLowerCase(), value);
  }
  return map;
}

export function normalizeFromSelectMap(raw: string | null | undefined, map: Map<string, string> | null): string | null {
  if (!raw || !map) return raw ?? null;
  const text = String(raw).trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  if (map.has(lower)) return map.get(lower)!;
  for (const [key, canonical] of map) {
    if (lower.includes(key) || key.includes(lower)) return canonical;
  }
  return text;
}
