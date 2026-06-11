export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('@/lib/env');
    validateEnv();

    const { assertDbPerformanceHealth } = await import('@/lib/db-performance-health');
    assertDbPerformanceHealth();

    const { markStaleCrawlRunsInterrupted } = await import('@/lib/query-modules/mobilebg');
    const n = markStaleCrawlRunsInterrupted();
    if (n > 0) {
      const { logger } = await import('@/lib/logger');
      logger.child('startup').info(`Reconciled ${n} stale crawl run(s) to 'interrupted'`);
    }
  }
}
