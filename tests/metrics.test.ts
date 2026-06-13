import { afterEach, describe, expect, it } from 'vitest';
import {
  incrementMetric,
  metricsSnapshot,
  observeDuration,
  resetMetrics,
} from '@/lib/observability/metrics';

afterEach(() => resetMetrics());

describe('metrics', () => {
  it('records counters and duration summaries', () => {
    incrementMetric('requests', { route: '/public' });
    incrementMetric('requests', { route: '/public' }, 2);
    observeDuration('latency', 10, { route: '/public' });
    observeDuration('latency', 20, { route: '/public' });

    expect(metricsSnapshot()).toEqual({
      counters: {
        'requests{route=/public}': 3,
      },
      durations: {
        'latency{route=/public}': {
          count: 2,
          maxMs: 20,
          avgMs: 15,
        },
      },
    });
  });
});
