/**
 * Resolves cars.bg make and model IDs from the publish form.
 */

import { USER_AGENT } from '@/lib/mobile-bg/constants';

const CARS_BG_BASE_URL = 'https://www.cars.bg';

interface OptionEntry { id: number; label: string; normalized: string }
interface OptionSet { options: OptionEntry[]; map: Map<string, OptionEntry>; sorted: OptionEntry[] }

let _brandOptionSet: OptionSet | null = null;
const _modelOptionsCache = new Map<number, OptionSet>();

function normalizeLabel(value = ''): string {
  return String(value).toLowerCase().replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function parseOptionMap(html: string, inputName: string): OptionSet {
  const regex = new RegExp(`<input[^>]*name=["']${inputName}["'][^>]*id=["'][^"']*_(\\d+)["'][^>]*>\\s*<label[^>]*>([^<]+)<`, 'gi');
  const options: OptionEntry[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const id = Number(match[1]);
    const label = match[2].trim();
    if (!label || Number.isNaN(id)) continue;
    options.push({ id, label, normalized: normalizeLabel(label) });
  }
  const map = new Map(options.map(opt => [opt.normalized, opt]));
  const sorted = [...options].sort((a, b) => b.label.length - a.label.length);
  return { options, map, sorted };
}

async function fetchCarsBgBrandOptions(): Promise<OptionSet> {
  if (_brandOptionSet) return _brandOptionSet;
  const res = await fetch(`${CARS_BG_BASE_URL}/publishcar.php?fromothersection=1`, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`cars.bg publish page failed: ${res.status}`);
  const html = await res.text();
  _brandOptionSet = parseOptionMap(html, 'brandId');
  return _brandOptionSet;
}

async function fetchCarsBgModelOptions(brandId: number): Promise<OptionSet | null> {
  if (!brandId) return null;
  if (_modelOptionsCache.has(brandId)) return _modelOptionsCache.get(brandId)!;
  const res = await fetch(`${CARS_BG_BASE_URL}/carmodelpublish.php?brandId=${brandId}`, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) return null;
  const html = await res.text();
  const parsed = parseOptionMap(html, 'modelId');
  _modelOptionsCache.set(brandId, parsed);
  return parsed;
}

export async function resolveCarsBgMakeModelIds({ title = '', make = '', model = '' }: { title?: string; make?: string; model?: string }): Promise<{ carsMakeId: number | null; carsModelId: number | null }> {
  const brands = await fetchCarsBgBrandOptions();
  const titleNormalized = normalizeLabel(title);

  let brand: OptionEntry | null = null;
  if (make) brand = brands.map.get(normalizeLabel(make)) ?? null;
  if (!brand) brand = brands.sorted.find(opt => titleNormalized.startsWith(opt.normalized)) ?? null;
  if (!brand) return { carsMakeId: null, carsModelId: null };

  const modelOptions = await fetchCarsBgModelOptions(brand.id);
  if (!modelOptions) return { carsMakeId: brand.id, carsModelId: null };

  const effectiveModel = model
    ? normalizeLabel(model)
    : normalizeLabel(title.replace(new RegExp(`^${brand.label}`, 'i'), '').trim().split(/\s+/).slice(0, 3).join(' '));

  let modelMatch: OptionEntry | null = null;
  if (model) modelMatch = modelOptions.map.get(normalizeLabel(model)) ?? null;
  if (!modelMatch && effectiveModel) modelMatch = modelOptions.sorted.find(opt => effectiveModel.startsWith(opt.normalized)) ?? null;
  if (!modelMatch && title) {
    const remainder = normalizeLabel(title.replace(new RegExp(`^${brand.label}`, 'i'), '').trim());
    modelMatch = modelOptions.sorted.find(opt => remainder.startsWith(opt.normalized)) ?? null;
  }

  return { carsMakeId: brand.id, carsModelId: modelMatch?.id ?? null };
}
