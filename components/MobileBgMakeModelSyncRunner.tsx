'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { readJsonError, startJsonStream, streamJsonEvents } from '@/lib/streaming-job';
import { errorMessage } from '@/lib/utils';

interface SyncLogEntry {
  type: 'status' | 'make' | 'complete' | 'error' | 'log' | 'exit';
  message?: string;
  make?: string;
  current?: number;
  total?: number;
  modelsProcessed?: number;
  makeCount?: number | null;
  modelCountsFound?: number;
  makesProcessed?: number;
  makeCountsFound?: number;
  searchPath?: string;
  pubtype?: string;
  onlyMake?: string | null;
  code?: number | null;
  level?: 'stdout' | 'stderr';
}

const DEFAULT_SEARCH_PATH = '/search/avtomobili-dzhipove';
const DEFAULT_PUBTYPE = '1,2';

export default function MobileBgMakeModelSyncRunner() {
  const t = useTranslations('ui');
  const [onlyMake, setOnlyMake] = useState('');
  const [searchPath, setSearchPath] = useState(DEFAULT_SEARCH_PATH);
  const [pubtype, setPubtype] = useState(DEFAULT_PUBTYPE);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<SyncLogEntry[]>([]);
  const [completed, setCompleted] = useState<SyncLogEntry | null>(null);

  async function run() {
    setRunning(true);
    setLog([]);
    setCompleted(null);

    try {
      const res = await startJsonStream('/api/mobile-bg/makes/sync', {
        json: {
          onlyMake: onlyMake.trim() || undefined,
          searchPath: searchPath.trim() || DEFAULT_SEARCH_PATH,
          pubtype: pubtype.trim() || DEFAULT_PUBTYPE,
        },
      });

      if (!res.ok || !res.body) {
        toast.error(await readJsonError(res, 'Sync failed to start'));
        setRunning(false);
        return;
      }

      let sawComplete = false;

      await streamJsonEvents<SyncLogEntry>(res, (entry) => {
        setLog((prev) => [...prev, entry]);

        if (entry.type === 'error') {
          toast.error(entry.message || 'Sync failed');
        }

        if (entry.type === 'complete') {
          sawComplete = true;
          setCompleted(entry);
          toast.success(`Sync completed: ${entry.makesProcessed ?? 0} makes, ${entry.modelsProcessed ?? 0} models`);
        }

        if (entry.type === 'exit' && entry.code && !sawComplete) {
          toast.error(`Sync exited with code ${entry.code}`);
        }
      });
    } catch (error) {
      toast.error(errorMessage(error, 'Sync failed'));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-700/60 bg-gray-800/30 p-5">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_160px]">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide text-gray-400">{t('make_filter')}</label>
          <input
            value={onlyMake}
            onChange={(e) => setOnlyMake(e.target.value)}
            placeholder={t('all_makes')}
            className="rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide text-gray-400">{t('search_path')}</label>
          <input
            value={searchPath}
            onChange={(e) => setSearchPath(e.target.value)}
            className="rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide text-gray-400">{t('pubtype')}</label>
          <input
            value={pubtype}
            onChange={(e) => setPubtype(e.target.value)}
            className="rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={run}
          disabled={running}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {running ? t('syncing') : t('sync_make_model_reference')}
        </button>
        <p className="text-xs text-gray-500">
          {t('sync_make_model_description')}
        </p>
      </div>

      {completed && (
        <div className="rounded border border-emerald-700/60 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-300">
          Synced {completed.makesProcessed ?? 0} makes and {completed.modelsProcessed ?? 0} models.
          {' '}Found {completed.makeCountsFound ?? 0} make counts and {completed.modelCountsFound ?? 0} model counts.
        </div>
      )}

      {(running || log.length > 0) && (
        <div className="rounded border border-gray-700 bg-gray-950/50">
          <div className="border-b border-gray-700 px-4 py-3">
            <div className="text-sm font-medium text-gray-200">{t('live_sync_feedback')}</div>
            <p className="mt-1 text-xs text-gray-500">{t('sync_progress_description')}</p>
          </div>

          <div className="max-h-96 space-y-2 overflow-y-auto px-4 py-3">
            {log.map((entry, index) => {
              if (entry.type === 'make') {
                return (
                  <div key={`${entry.make || 'make'}-${index}`} className="rounded border border-gray-800 bg-gray-900/70 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-white">{entry.make}</div>
                      <div className="text-xs text-gray-400">
                        {entry.current ?? 0}/{entry.total ?? 0}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      {entry.modelsProcessed ?? 0} models, make count {entry.makeCount ?? '—'}, model counts found {entry.modelCountsFound ?? 0}
                    </div>
                  </div>
                );
              }

              const tone = entry.type === 'error'
                ? 'text-red-300'
                : entry.level === 'stderr'
                  ? 'text-amber-300'
                  : 'text-gray-300';

              return (
                <div key={`${entry.type}-${index}`} className={`rounded border border-gray-800 bg-gray-900/70 px-3 py-2 text-sm ${tone}`}>
                  {entry.message || (entry.type === 'exit' ? `Process exited with code ${entry.code ?? 'unknown'}` : entry.type)}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
