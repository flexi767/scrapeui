'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { errorMessage, parseApiResponse } from '@/lib/utils';

interface Dealer { id: number; slug: string; name: string; }

interface Change {
  id: number;
  dealer: string;
  title: string;
  before: string;
  after: string;
}

interface Result {
  processed: number;
  changed: number;
  dryRun: boolean;
  changes: Change[];
}

export default function ReparseRunner({ dealers }: { dealers: Dealer[] }) {
  const t = useTranslations('ui');
  const [dealer, setDealer]       = useState('');
  const [missingOnly, setMissing] = useState(false);
  const [dryRun, setDryRun]       = useState(true);
  const [running, setRunning]     = useState(false);
  const [result, setResult]       = useState<Result | null>(null);
  const [error, setError]         = useState('');

  async function run() {
    setRunning(true);
    setResult(null);
    setError('');
    try {
      const res = await fetch('/api/listings/reparse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealer: dealer || undefined, missingOnly, dryRun }),
      });
      const data = await parseApiResponse<Result>(res, 'Reparse failed');
      setResult(data);
    } catch (e) {
      setError(errorMessage(e, 'Reparse failed'));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-700/60 bg-gray-800/30 p-5">

      {/* Options */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">{t('dealer')}</label>
          <select
            value={dealer}
            onChange={e => setDealer(e.target.value)}
            className="rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="">{t('all_dealers')}</option>
            {dealers.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer pb-2">
          <input type="checkbox" checked={missingOnly} onChange={e => setMissing(e.target.checked)}
            className="rounded border-gray-600 bg-gray-800 text-blue-500" />
          {t('missing_only')}
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer pb-2">
          <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)}
            className="rounded border-gray-600 bg-gray-800 text-blue-500" />
          {t('dry_run')}
        </label>

        <button
          onClick={run}
          disabled={running}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 pb-2"
        >
          {running ? t('running_ellipsis') : t('reparse')}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Result summary */}
      {result && (
        <div className="space-y-3">
          <p className="text-sm text-gray-300">
            {t('processed')} <span className="text-white font-medium">{result.processed}</span> {t('listings')}
            {' — '}
            <span className="text-white font-medium">{result.changed}</span> {t('would_change')}
            {result.dryRun
              ? <span className="ml-2 text-yellow-400 text-xs">{t('dry_run_no_writes')}</span>
              : <span className="ml-2 text-emerald-400 text-xs">{t('saved_check')}</span>
            }
          </p>

          {result.changes.length > 0 && (
            <div className="max-h-72 overflow-y-auto rounded border border-gray-700 divide-y divide-gray-700/60">
              {result.changes.map(c => (
                <div key={c.id} className="px-3 py-2 text-xs">
                  <p className="text-gray-400 truncate">{c.dealer} · #{c.id} · {c.title}</p>
                  <p className="mt-0.5">
                    <span className="text-red-400">{c.before || '—'}</span>
                    <span className="text-gray-500 mx-2">→</span>
                    <span className="text-emerald-400">{c.after}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
