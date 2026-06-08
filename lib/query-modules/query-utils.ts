export function omitQueryFields<T extends object, K extends keyof T>(
  row: T,
  fields: readonly K[],
): Omit<T, K> {
  const copy = { ...row };
  for (const field of fields) {
    delete (copy as Partial<T>)[field];
  }
  return copy;
}

export function getWindowTotal<T extends object, K extends keyof T>(
  rows: Array<T & Record<K, number>>,
  page: number,
  countFallback: () => number,
  field: K,
): number {
  return rows[0]?.[field] ?? (page > 1 ? countFallback() : 0);
}
