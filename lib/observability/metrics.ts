interface DurationSummary {
  count: number;
  maxMs: number;
  totalMs: number;
}

const counters = new Map<string, number>();
const durations = new Map<string, DurationSummary>();

function labelKey(name: string, labels: Record<string, string | number | boolean> = {}) {
  const suffix = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(',');
  return suffix ? `${name}{${suffix}}` : name;
}

export function incrementMetric(
  name: string,
  labels?: Record<string, string | number | boolean>,
  value = 1,
): void {
  const key = labelKey(name, labels);
  counters.set(key, (counters.get(key) ?? 0) + value);
}

export function observeDuration(
  name: string,
  ms: number,
  labels?: Record<string, string | number | boolean>,
): void {
  const key = labelKey(name, labels);
  const current = durations.get(key) ?? { count: 0, maxMs: 0, totalMs: 0 };
  current.count += 1;
  current.totalMs += ms;
  current.maxMs = Math.max(current.maxMs, ms);
  durations.set(key, current);
}

export function metricsSnapshot() {
  return {
    counters: Object.fromEntries(counters),
    durations: Object.fromEntries(
      [...durations.entries()].map(([key, summary]) => [
        key,
        {
          count: summary.count,
          maxMs: Math.round(summary.maxMs),
          avgMs: summary.count > 0 ? Math.round(summary.totalMs / summary.count) : 0,
        },
      ]),
    ),
  };
}

export function resetMetrics(): void {
  counters.clear();
  durations.clear();
}
