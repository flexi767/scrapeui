'use client';

import { useTranslations } from 'next-intl';
import { LogPanel } from './LogPanel';
import type { LogEntry, OwnDealer, RunStats } from './types';

export function RenewResetPanel({
  ownDealers,
  renewDealers,
  renewOnlyReset,
  renewRunning,
  renewStopping,
  renewStats,
  renewDone,
  renewLogs,
  running,
  renewLogRef,
  onToggleDealer,
  onToggleAllDealers,
  onToggleOnlyReset,
  onRunOrStop,
}: {
  ownDealers: OwnDealer[];
  renewDealers: string[];
  renewOnlyReset: boolean;
  renewRunning: boolean;
  renewStopping: boolean;
  renewStats: RunStats | null;
  renewDone: RunStats | null;
  renewLogs: LogEntry[];
  running: boolean;
  renewLogRef: React.RefObject<HTMLDivElement | null>;
  onToggleDealer: (slug: string) => void;
  onToggleAllDealers: () => void;
  onToggleOnlyReset: () => void;
  onRunOrStop: () => void;
}) {
  const t = useTranslations('ui');
  if (ownDealers.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-6 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {renewStats && (
          <>
            <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm">
              <span className="uppercase tracking-wide text-gray-500">{t('total')}</span>
              <span className="ml-2 text-lg font-semibold text-white">{renewStats.total}</span>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm">
              <span className="uppercase tracking-wide text-gray-500">{t('success')}</span>
              <span className="ml-2 text-lg font-semibold text-emerald-400">{renewStats.succeeded}</span>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm">
              <span className="uppercase tracking-wide text-gray-500">{t('failed')}</span>
              <span className="ml-2 text-lg font-semibold text-red-400">{renewStats.failed}</span>
            </div>
          </>
        )}
        <div className="ml-auto rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm text-right">
          <span className="uppercase tracking-wide text-gray-500">{t('mode')}</span>
          <span className="ml-2 text-sm font-medium text-gray-100">{renewRunning ? t('running') : t('idle')}</span>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-300">
          <span>{t('dealers')}</span>
          <span className="text-xs text-gray-500">({renewDealers.length} selected)</span>
          <button
            type="button"
            onClick={onToggleAllDealers}
            disabled={renewRunning}
            className="text-xs font-medium text-blue-400 transition-colors hover:text-blue-300 disabled:cursor-not-allowed disabled:text-gray-600"
          >
            {renewDealers.length === ownDealers.length ? t('deselect_all') : t('select_all')}
          </button>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {ownDealers.map((dealer) => (
            <label key={dealer.slug} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={renewDealers.includes(dealer.slug)}
                onChange={() => onToggleDealer(dealer.slug)}
                disabled={renewRunning}
                className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 disabled:opacity-50"
              />
              <span className="text-sm text-gray-200">{dealer.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={onRunOrStop}
          disabled={renewStopping || (!renewRunning && renewDealers.length === 0) || running}
          className={`flex items-center gap-2 rounded-md px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${
            renewRunning ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'
          }`}
        >
          {(renewRunning || renewStopping) && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {renewStopping ? t('stopping') : renewRunning ? t('stop') : renewOnlyReset ? t('reset_views') : t('renew_and_reset')}
        </button>

        <div
          onClick={renewRunning ? undefined : onToggleOnlyReset}
          className={`flex items-center gap-3 ${renewRunning ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        >
          <div
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${renewOnlyReset ? 'bg-blue-600' : 'bg-gray-600'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${renewOnlyReset ? 'translate-x-6' : 'translate-x-1'}`} />
          </div>
          <span className="text-sm font-medium text-gray-200">{t('only_reset_views')}</span>
        </div>
      </div>

      {renewDone && (
        <div className="rounded-lg border border-green-700/60 bg-green-900/20 px-4 py-3 text-sm text-green-400">
          {renewOnlyReset ? t('done_reset_count', { count: renewDone.succeeded, failed: renewDone.failed }) : t('done_renewed_count', { count: renewDone.succeeded, failed: renewDone.failed })}
        </div>
      )}

      {renewLogs.length > 0 && (
        <LogPanel entries={renewLogs} panelRef={renewLogRef} keyPrefix="renew" />
      )}
    </div>
  );
}
