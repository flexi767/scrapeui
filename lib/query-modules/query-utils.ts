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

const DEFAULT_SLOW_QUERY_MS = 150;

export function timedQuery<T>(
  label: string,
  details: Record<string, unknown>,
  run: () => T,
): T {
  const startedAt = performance.now();
  try {
    return run();
  } finally {
    const elapsedMs = performance.now() - startedAt;
    const thresholdMs = Number(process.env.SLOW_QUERY_MS ?? DEFAULT_SLOW_QUERY_MS);
    if (Number.isFinite(thresholdMs) && elapsedMs >= thresholdMs) {
      console.warn(`[slow-query] ${label}`, {
        elapsedMs: Math.round(elapsedMs),
        ...details,
      });
    }
  }
}
