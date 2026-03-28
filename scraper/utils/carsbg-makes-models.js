const { USER_AGENT } = require('./constants');

const CARS_BG_BASE_URL = 'https://www.cars.bg';
let brandOptionSet = null;
const modelOptionsCache = new Map();

function normalizeLabel(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseOptionMap(html, inputName) {
  const regex = new RegExp(`<input[^>]*name=["']${inputName}["'][^>]*id=["'][^"']*_(\\d+)["'][^>]*>\\s*<label[^>]*>([^<]+)<`, 'gi');
  const options = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    const id = Number(match[1]);
    const label = match[2].trim();
    if (!label || Number.isNaN(id)) continue;
    options.push({ id, label, normalized: normalizeLabel(label) });
  }
  const map = new Map(options.map((opt) => [opt.normalized, opt]));
  const sorted = [...options].sort((a, b) => b.label.length - a.label.length);
  return { options, map, sorted };
}

async function fetchCarsBgBrandOptions() {
  if (brandOptionSet) return brandOptionSet;
  const res = await fetch(`${CARS_BG_BASE_URL}/publishcar.php?fromothersection=1`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`cars.bg publish page failed: ${res.status}`);
  const html = await res.text();
  brandOptionSet = parseOptionMap(html, 'brandId');
  return brandOptionSet;
}

async function fetchCarsBgModelOptions(brandId) {
  if (!brandId) return null;
  if (modelOptionsCache.has(brandId)) return modelOptionsCache.get(brandId);
  const res = await fetch(`${CARS_BG_BASE_URL}/carmodelpublish.php?brandId=${brandId}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const parsed = parseOptionMap(html, 'modelId');
  modelOptionsCache.set(brandId, parsed);
  return parsed;
}

async function resolveCarsBgMakeModelIds({ title = '', make = '', model = '' }) {
  const brands = await fetchCarsBgBrandOptions();
  const titleNormalized = normalizeLabel(title);

  let brand = null;
  if (make) brand = brands.map.get(normalizeLabel(make)) || null;
  if (!brand) {
    brand = brands.sorted.find((opt) => titleNormalized.startsWith(opt.normalized)) || null;
  }
  if (!brand) return { carsMakeId: null, carsModelId: null };

  const modelOptions = await fetchCarsBgModelOptions(brand.id);
  if (!modelOptions) return { carsMakeId: brand.id, carsModelId: null };

  const effectiveModel = model ? normalizeLabel(model) : normalizeLabel(title.replace(new RegExp(`^${brand.label}`, 'i'), '').trim().split(/\s+/).slice(0, 3).join(' '));
  let modelMatch = null;

  if (model) {
    modelMatch = modelOptions.map.get(normalizeLabel(model)) || null;
  }
  if (!modelMatch && effectiveModel) {
    modelMatch = modelOptions.sorted.find((opt) => effectiveModel.startsWith(opt.normalized)) || null;
  }
  if (!modelMatch && title) {
    const remainder = normalizeLabel(title.replace(new RegExp(`^${brand.label}`, 'i'), '').trim());
    modelMatch = modelOptions.sorted.find((opt) => remainder.startsWith(opt.normalized)) || null;
  }

  return { carsMakeId: brand.id, carsModelId: modelMatch?.id || null };
}

module.exports = {
  fetchCarsBgBrandOptions,
  fetchCarsBgModelOptions,
  resolveCarsBgMakeModelIds,
  normalizeLabel,
  parseOptionMap,
};
