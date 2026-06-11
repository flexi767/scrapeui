'use client';

import { useTranslations } from 'next-intl';
import type { RunStats } from './types';

interface BatchSyncPanelProps {
  currentLabel: string | null;
  doneSummary: RunStats | null;
  failedCount: number;
  pendingCount: number;
  running: boolean;
  stats: RunStats | null;
  stopping: boolean;
  successCount: number;
  onRunOrStop: () => void;
}

export function BatchSyncPanel({
  currentLabel,
  doneSummary,
  failedCount,
  pendingCount,
  running,
  stats,
  stopping,
  successCount,
  onRunOrStop,
}: BatchSyncPanelProps) {
  const t = useTranslations('ui');

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-6 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm">
          <span className="uppercase tracking-wide text-gray-500">{t('pending')}</span>
          <span className="ml-2 text-lg font-semibold text-white">{pendingCount}</span>
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm">
          <span className="uppercase tracking-wide text-gray-500">{t('completed')}</span>
          <span className="ml-2 text-lg font-semibold text-white">{stats?.completed ?? doneSummary?.completed ?? 0}</span>
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm">
          <span className="uppercase tracking-wide text-gray-500">{t('success')}</span>
          <span className="ml-2 text-lg font-semibold text-emerald-400">{stats?.succeeded ?? successCount}</span>
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm">
          <span className="uppercase tracking-wide text-gray-500">{t('failed')}</span>
          <span className="ml-2 text-lg font-semibold text-red-400">{stats?.failed ?? failedCount}</span>
        </div>
        <div className="ml-auto rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm text-right">
          <span className="uppercase tracking-wide text-gray-500">{t('mode')}</span>
          <span className="ml-2 text-sm font-medium text-gray-100">{running ? t('syncing_queue') : t('idle')}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={onRunOrStop}
          disabled={stopping || (!running && pendingCount === 0)}
          className={`flex items-center gap-2 rounded-md px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${
            running ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'
          }`}
        >
          {(running || stopping) && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {stopping ? t('stopping') : running ? t('stop') : `${t('sync_all')}${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
        </button>

        {currentLabel && (
          <div className="min-w-0 flex-1 rounded-lg border border-sky-700/40 bg-sky-950/30 px-3 py-2 text-sm text-sky-200">
            <div className="text-[11px] uppercase tracking-wide text-sky-300/70">{t('current')}</div>
            <div className="mt-1 truncate">{currentLabel}</div>
          </div>
        )}
      </div>
    </div>
  );
}
