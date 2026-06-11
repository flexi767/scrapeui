'use client';

import { useTranslations } from 'next-intl';
import type { CarsBgSyncTotals } from '@/components/cars-bg-sync/types';

interface CarsBgSyncOverviewProps {
  totals: CarsBgSyncTotals;
  running: boolean;
  liveMode: boolean;
  doneSummary: CarsBgSyncTotals | null;
}

export function CarsBgSyncOverview({ totals, running, liveMode, doneSummary }: CarsBgSyncOverviewProps) {
  const t = useTranslations('ui');

  const modeLabel = running
    ? (liveMode ? t('running_live') : t('planning'))
    : (doneSummary ? (liveMode ? t('last_run_live') : t('last_preview')) : t('idle'));

  return (
    <div className="flex flex-wrap gap-3">
      <MetricCard label={t('missing')} value={totals.missing} valueClassName="text-white" />
      <MetricCard label={t('diffs')} value={totals.diffs} valueClassName="text-amber-300" />
      <MetricCard label={t('stale')} value={totals.stale} valueClassName="text-red-300" />
      <MetricCard label={t('updated')} value={totals.updated} valueClassName="text-sky-300" />
      <MetricCard label={t('created')} value={totals.created} valueClassName="text-emerald-400" />
      <MetricCard label={t('deleted')} value={totals.deleted} valueClassName="text-red-400" />
      <div className="ml-auto rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-right text-sm">
        <span className="uppercase tracking-wide text-gray-500">{t('mode')}</span>
        <span className="ml-2 text-sm font-medium text-gray-100">{modeLabel}</span>
      </div>
    </div>
  );
}

function MetricCard({ label, value, valueClassName }: { label: string; value: number; valueClassName: string }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm">
      <span className="uppercase tracking-wide text-gray-500">{label}</span>
      <span className={`ml-2 text-lg font-semibold ${valueClassName}`}>{value}</span>
    </div>
  );
}
