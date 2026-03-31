export type VatValue = 'included' | 'exempt' | 'excluded';

export function normalizeVatValue(value: unknown): VatValue | null {
  if (value == null || value === '') return null;
  if (value === 1 || value === '1' || value === 'included') return 'included';
  if (value === 0 || value === '0' || value === 'exempt') return 'exempt';
  if (value === 'excluded') return 'excluded';
  return null;
}

export function getVatBadgeLabel(value: unknown): string {
  const vat = normalizeVatValue(value);
  if (vat === 'included') return 'има';
  if (vat === 'exempt') return 'няма';
  if (vat === 'excluded') return '+ДДС';
  return '—';
}

export function getMobileBgVatLabel(value: unknown): string | null {
  const vat = normalizeVatValue(value);
  if (vat === 'included') return 'Цената е с включено ДДС';
  if (vat === 'exempt') return 'Частна продажба. / Освободена от ДДС продажба.';
  if (vat === 'excluded') return 'Цената е без ДДС';
  return null;
}

export function getVatFromMobileBgLabel(value: string | null | undefined): VatValue | null {
  if (!value) return null;
  if (value.includes('включено')) return 'included';
  if (value.includes('без ДДС')) return 'excluded';
  if (value.includes('Освободена') || value.includes('Частна')) return 'exempt';
  return null;
}
