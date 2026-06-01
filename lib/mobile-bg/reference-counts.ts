import { normalizeMakeModelLabel } from './makes-models';

export function buildMobileBgSearchUrl(searchPath: string, params: Record<string, string>): string {
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

export function parseMakeCountsFromHtml(html: string): Map<string, number> {
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

export function parseModelCountsFromHtml(html: string): Map<string, number> {
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

