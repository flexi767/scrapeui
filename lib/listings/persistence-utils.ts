export function booleanFlag(value: boolean | number | null | undefined): number {
  return value ? 1 : 0;
}

export function priceChanged(
  nextPrice: number | null,
  previousPrice: number | null | undefined,
): boolean {
  return nextPrice !== null && nextPrice !== previousPrice;
}

export function normalizeProvidedDescription(value: string | null | undefined) {
  const provided = typeof value === 'string';
  return {
    provided,
    value: provided ? value.trim() || null : null,
  };
}

export function jsonOrNull(value: unknown[] | null | undefined): string | null {
  return value?.length ? JSON.stringify(value) : null;
}
