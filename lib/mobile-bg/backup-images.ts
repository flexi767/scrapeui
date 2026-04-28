export function normalizeImageUrl(value: string): string | null {
  if (!value) return null;

  try {
    return new URL(value).toString();
  } catch {
    try {
      return new URL(value, "https://www.mobile.bg").toString();
    } catch {
      return null;
    }
  }
}

export function toMobileBgFullImageUrl(value: string): string | null {
  const normalized = normalizeImageUrl(value);
  if (!normalized) return null;
  return normalized
    .replace(/(\/mobile\/photosorg\/\d+)\/(\d+)\/(?!big1)/, "$1/$2/big1/")
    .replace(/\/(\d+)\/big1\/big1\//, "/$1/big1/");
}
