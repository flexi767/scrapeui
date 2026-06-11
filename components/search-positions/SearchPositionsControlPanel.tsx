'use client';

import { useTranslations } from 'next-intl';
import { SearchPositionPreviewThumb } from '@/components/search-positions/SearchPositionPreviewThumb';
import type { RankStats, SearchPositionPreview, SearchPositionSummary } from '@/components/search-positions/types';

interface SearchPositionsControlPanelProps {
  running: boolean;
  stopping: boolean;
  activeMode: 'all' | 'missing' | null;
  stats: RankStats | null;
  doneSummary: SearchPositionSummary | null;
  currentLabel: string | null;
  currentPreview: SearchPositionPreview | null;
  onCheckAll: () => void;
  onMissingOnly: () => void;
}

export function SearchPositionsControlPanel({
  running,
  stopping,
  activeMode,
  stats,
  doneSummary,
  currentLabel,
  currentPreview,
  onCheckAll,
  onMissingOnly,
}: SearchPositionsControlPanelProps) {
  const t = useTranslations('ui');

  return (
    <div className="space-y-5 rounded-lg border border-gray-700 bg-gray-800/60 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{t('check_search_positions')}</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            {t('check_search_positions_desc')}
          </p>
        </div>

        <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-3 text-right">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">{t('mode')}</div>
          <div className="mt-1 text-sm font-medium text-gray-100">
            {running ? (activeMode === 'missing' ? t('missing_only') : t('all_listings')) : t('idle')}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label={t('total')} value={stats?.total ?? doneSummary?.total ?? '—'} valueClassName="text-white" />
        <MetricCard label={t('checked')} value={stats?.checked ?? doneSummary?.total ?? 0} valueClassName="text-white" />
        <MetricCard label={t('found')} value={stats?.found ?? doneSummary?.found ?? 0} valueClassName="text-emerald-400" />
        <MetricCard label={t('missing')} value={stats?.notFound ?? doneSummary?.notFound ?? 0} valueClassName="text-amber-300" />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={onCheckAll}
          disabled={stopping}
          className={`flex items-center gap-2 rounded-md px-5 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            running ? 'bg-red-600 hover:bg-red-500' : 'bg-amber-600 hover:bg-amber-500'
          }`}
        >
          {(running || stopping) && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {stopping ? t('stopping') : running ? t('stop') : t('check_all')}
        </button>

        <button
          onClick={onMissingOnly}
          disabled={running}
          className="rounded-md border border-gray-600 px-5 py-2 text-sm font-semibold text-gray-200 transition-colors hover:border-gray-500 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('missing_only')}
        </button>

        {currentLabel && (
          <div className="min-w-0 flex-1 rounded-lg border border-sky-700/40 bg-sky-950/30 px-3 py-2 text-sm text-sky-200">
            <div className="text-[11px] uppercase tracking-wide text-sky-300/70">{t('current')}</div>
            <div className="mt-2 flex items-center gap-3">
              <SearchPositionPreviewThumb
                thumbUrl={currentPreview?.thumbUrl ?? null}
                listingUrl={currentPreview?.listingUrl ?? null}
                label={currentLabel}
              />
              <div className="min-w-0 truncate">{currentLabel}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, valueClassName }: { label: string; value: number | string; valueClassName: string }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${valueClassName}`}>{value}</div>
    </div>
  );
}
