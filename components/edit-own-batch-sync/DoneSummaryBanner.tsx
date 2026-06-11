'use client';

import { useTranslations } from 'next-intl';
import type { RunStats } from './types';

export function DoneSummaryBanner({ summary }: { summary: RunStats | null }) {
  const t = useTranslations('ui');

  if (!summary) return null;

  return (
    <div className="rounded-lg border border-green-700/60 bg-green-900/20 px-4 py-3 text-sm text-green-400">
      {t('done_summary', { completed: summary.completed, total: summary.total, succeeded: summary.succeeded, failed: summary.failed })}
    </div>
  );
}
