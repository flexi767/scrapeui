export function normalizeLabel(value = ''): string {
  return String(value)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9а-я\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeCompareText(value: string | null | undefined): string {
  return String(value || '')
    .replace(/[💵📞✓]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9а-я]+/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeCarsBgDescriptionText(value: string | null | undefined): string {
  return String(value || '').replace(/[💵📞✓]/gu, '✓');
}

export function sanitizeCarsBgDescription(value: string | null | undefined): string {
  return normalizeCarsBgDescriptionText(value)
    .replace(/(^|\s|[,.!?:;()\-])Възможност\s+за\s+данъчен\s+кредит(?=$|\s|[,.!?:;()\-])/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function normalizeCarsBgTitleText(value: string | null | undefined): string {
  return String(value || '').replace(/[💵📞✓]/gu, '');
}

export function sanitizeCarsBgTitle(value: string | null | undefined): string {
  return normalizeCarsBgTitleText(value).trim();
}

export function titleOverlapScore(a: string | null | undefined, b: string | null | undefined): number {
  const aTokens = new Set(normalizeCompareText(a).split(' ').filter((token) => token.length > 2));
  const bTokens = new Set(normalizeCompareText(b).split(' ').filter((token) => token.length > 2));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap++;
  }
  return overlap;
}

