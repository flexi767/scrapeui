'use client';

import type { Ref } from 'react';
import { useTranslations } from 'next-intl';
import { tailRenderWindow } from '@/components/shared/render-window';
import type { CarsBgSyncLogEntry } from '@/components/cars-bg-sync/types';

interface CarsBgSyncLogPanelProps {
  logs: CarsBgSyncLogEntry[];
  logRef: Ref<HTMLDivElement>;
}

export function CarsBgSyncLogPanel({ logs, logRef }: CarsBgSyncLogPanelProps) {
  const t = useTranslations('ui');
  const visibleLogs = tailRenderWindow(logs);

  return (
    <div className="rounded-xl border border-gray-700/60 bg-gray-900/40">
      <div className="border-b border-gray-700/60 px-4 py-3 text-sm font-medium text-gray-200">{t('live_log')}</div>
      <div ref={logRef} className="max-h-[420px] overflow-y-auto px-4 py-3 font-mono text-xs leading-6">
        {logs.length === 0 ? (
          <div className="text-gray-500">{t('no_output_yet')}</div>
        ) : (
          <>
            {visibleLogs.hiddenCount > 0 && (
              <div className="text-gray-500">{visibleLogs.hiddenCount} older entries hidden</div>
            )}
            {visibleLogs.items.map((entry, index) => (
              <div
                key={`${visibleLogs.startIndex + index}-${entry.message}`}
                className={
                  entry.kind === 'error'
                    ? 'text-red-300'
                    : entry.kind === 'status'
                      ? 'text-sky-200'
                      : 'text-gray-300'
                }
              >
                {entry.message}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
