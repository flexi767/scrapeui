'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { EditOwnSyncRow } from '@/lib/queries';
import { formatDate, formatPrice } from '@/lib/utils';
import { readJsonError, streamJsonEvents } from '@/lib/streaming-job';
import { getPriceWithVat } from '@/lib/vat';
import { LogPanel } from './edit-own-batch-sync/LogPanel';
import { SyncBadge } from './edit-own-batch-sync/SyncBadge';
import {
  buildChangeRows,
  isEditOwnSyncRow,
  labelForRow,
  toBatchRow,
} from './edit-own-batch-sync/helpers';
import type { BatchRow, LogEntry, OwnDealer, RunStats, StreamEntry } from './edit-own-batch-sync/types';

interface Props {
  initialRows: EditOwnSyncRow[];
  autoRun?: boolean;
  ownDealers: OwnDealer[];
}

export default function EditOwnBatchSync({ initialRows, autoRun = false, ownDealers }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<BatchRow[]>(() => initialRows.map(toBatchRow));
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [doneSummary, setDoneSummary] = useState<RunStats | null>(null);
  const [revertingId, setRevertingId] = useState<number | null>(null);
  const [renewDealers, setRenewDealers] = useState<string[]>(() => ownDealers.map((d) => d.slug));
  const [renewOnlyReset, setRenewOnlyReset] = useState(false);
  const [renewRunning, setRenewRunning] = useState(false);
  const [renewStopping, setRenewStopping] = useState(false);
  const [renewStats, setRenewStats] = useState<RunStats | null>(null);
  const [renewLogs, setRenewLogs] = useState<LogEntry[]>([]);
  const [renewDone, setRenewDone] = useState<RunStats | null>(null);
  const startedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const renewAbortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const renewLogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    if (!renewLogRef.current) return;
    renewLogRef.current.scrollTop = renewLogRef.current.scrollHeight;
  }, [renewLogs]);

  const pendingCount = rows.filter((row) => row.needs_sync === 1).length;
  const successCount = rows.filter((row) => row.runStatus === 'success').length;
  const failedCount = rows.filter((row) => row.runStatus === 'failed').length;

  const recentResults = useMemo(
    () => rows.filter((row) => row.runStatus === 'success' || row.runStatus === 'failed').slice().reverse().slice(0, 12),
    [rows],
  );
  const appendLog = (entry: LogEntry) => setLogs((prev) => [...prev, entry]);

  async function revertDraft(row: BatchRow) {
    setRevertingId(row.backup_id);
    try {
      const res = await fetch(`/api/editown/sync-drafts/${row.backup_id}`, { method: 'POST' });
      const data = await res.json().catch(() => null) as EditOwnSyncRow | { error?: string } | null;
      if (!res.ok || !isEditOwnSyncRow(data)) {
        throw new Error((data && 'error' in data ? data.error : null) || 'Failed to revert draft');
      }

      setRows((prev) => prev.map((entry) => entry.backup_id === row.backup_id ? toBatchRow(data) : entry));
      toast.success('Draft reverted to original listing values');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to revert draft');
    } finally {
      setRevertingId(null);
    }
  }

  async function run() {
    setRunning(true);
    setStopping(false);
    setLogs([]);
    setCurrentLabel(null);
    setDoneSummary(null);
    setStats({
      total: rows.filter((row) => row.needs_sync === 1).length,
      completed: 0,
      succeeded: 0,
      failed: 0,
    });
    setRows((prev) => prev.map((row) => row.needs_sync === 1 ? {
      ...row,
      runStatus: 'pending',
      runError: null,
      completedAt: row.completedAt,
    } : row));

    const abortController = new AbortController();
    abortRef.current = abortController;

    let res: Response;
    try {
      res = await fetch('/api/editown/batch-sync', {
        method: 'POST',
        signal: abortController.signal,
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setRunning(false);
        setStopping(false);
        abortRef.current = null;
        return;
      }
      const message = error instanceof Error ? error.message : 'Batch sync failed';
      toast.error(message);
      setLogs([{ kind: 'error', message }]);
      setRunning(false);
      setStopping(false);
      abortRef.current = null;
      return;
    }

    if (!res.ok || !res.body) {
      const message = await readJsonError(res, 'Failed to start batch sync');
      toast.error(message);
      setLogs([{ kind: 'error', message }]);
      setRunning(false);
      setStopping(false);
      abortRef.current = null;
      return;
    }

    try {
      await streamJsonEvents<StreamEntry>(res, (event) => {
            if (event.type === 'start') {
              setStats({
                total: event.total,
                completed: event.completed,
                succeeded: event.succeeded,
                failed: event.failed,
              });
              if (event.message) appendLog({ kind: 'status', message: event.message });
              return;
            }

            if (event.type === 'checking') {
              setStats({
                total: event.total,
                completed: event.completed,
                succeeded: event.succeeded,
                failed: event.failed,
              });
              setCurrentLabel(labelForRow({ ...event.target, mobile_id: event.target.mobile_id }));
              setRows((prev) => prev.map((row) => row.backup_id === event.target.backup_id ? {
                ...row,
                runStatus: 'running',
                runError: null,
              } : row));
              if (event.message) appendLog({ kind: 'status', message: event.message });
              return;
            }

            if (event.type === 'result') {
              setStats({
                total: event.total,
                completed: event.completed,
                succeeded: event.succeeded,
                failed: event.failed,
              });
              setRows((prev) => prev.map((row) => row.backup_id === event.row.backup_id ? {
                ...row,
                needs_sync: event.row.status === 'success' ? 0 : row.needs_sync,
                runStatus: event.row.status,
                runError: event.row.error,
                completedAt: event.row.completed_at,
              } : row));
              if (event.message) {
                appendLog({
                  kind: 'result',
                  ok: event.row.status === 'success',
                  message: event.message,
                });
              }
              return;
            }

            if (event.type === 'log') {
              if (event.message) {
                appendLog({
                  kind: event.level === 'stderr' ? 'error' : 'log',
                  message: event.message,
                });
              }
              return;
            }

            if (event.type === 'error') {
              const message = event.message || 'Batch sync failed';
              appendLog({ kind: 'error', message });
              toast.error(message);
              return;
            }

            if (event.type === 'complete') {
              const summary = {
                total: event.total,
                completed: event.completed,
                succeeded: event.succeeded,
                failed: event.failed,
              };
              setDoneSummary(summary);
              setStats(summary);
              setCurrentLabel(null);
              setRunning(false);
              setStopping(false);
              abortRef.current = null;
              if (event.message) appendLog({ kind: 'status', message: event.message });
              if (event.failed === 0) {
                toast.success(`Synced ${event.succeeded} listing${event.succeeded === 1 ? '' : 's'} to mobile.bg`);
              } else {
                toast.error(`Synced ${event.succeeded}, ${event.failed} failed`);
              }
              router.refresh();
              return;
            }
      });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        const message = error instanceof Error ? error.message : 'Batch sync failed';
        appendLog({ kind: 'error', message });
        toast.error(message);
      }
    } finally {
      setRunning(false);
      setStopping(false);
      abortRef.current = null;
      setCurrentLabel(null);
    }
  }

  async function stop() {
    if (!running || stopping) return;
    setStopping(true);

    try {
      const res = await fetch('/api/editown/batch-sync', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to stop batch sync');
      }
      appendLog({ kind: 'log', message: 'Stopping batch sync…' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop batch sync';
      appendLog({ kind: 'error', message });
      toast.error(message);
      setStopping(false);
      return;
    }

    abortRef.current?.abort();
  }

  const appendRenewLog = (entry: LogEntry) => setRenewLogs((prev) => [...prev, entry]);

  async function runRenewReset() {
    if (renewDealers.length === 0) {
      toast.error('Select at least one dealer');
      return;
    }
    setRenewRunning(true);
    setRenewStopping(false);
    setRenewLogs([]);
    setRenewDone(null);
    setRenewStats({ total: 0, completed: 0, succeeded: 0, failed: 0 });

    const abortController = new AbortController();
    renewAbortRef.current = abortController;

    let res: Response;
    try {
      res = await fetch('/api/editown/renew-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealerSlugs: renewDealers, onlyReset: renewOnlyReset }),
        signal: abortController.signal,
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setRenewRunning(false);
        setRenewStopping(false);
        renewAbortRef.current = null;
        return;
      }
      toast.error(error instanceof Error ? error.message : 'Renew & reset failed');
      setRenewRunning(false);
      setRenewStopping(false);
      renewAbortRef.current = null;
      return;
    }

    if (!res.ok || !res.body) {
      const message = await readJsonError(res, 'Failed to start renew & reset');
      toast.error(message);
      setRenewRunning(false);
      setRenewStopping(false);
      renewAbortRef.current = null;
      return;
    }

    try {
      await streamJsonEvents<StreamEntry>(res, (event) => {
            if (event.type === 'start' || event.type === 'checking' || event.type === 'result' || event.type === 'complete') {
              const s = { total: (event as RunStats).total ?? 0, completed: (event as RunStats).completed ?? 0, succeeded: (event as RunStats).succeeded ?? 0, failed: (event as RunStats).failed ?? 0 };
              setRenewStats(s);
              if (event.type === 'complete') {
                setRenewDone(s);
                setRenewRunning(false);
                setRenewStopping(false);
                renewAbortRef.current = null;
                if (s.failed === 0) toast.success(`Renewed ${s.succeeded} listing${s.succeeded === 1 ? '' : 's'}`);
                else toast.error(`Renewed ${s.succeeded}, ${s.failed} failed`);
              }
            }

            if (event.type === 'log' || event.type === 'error') {
              if (event.message) appendRenewLog({ kind: event.type === 'error' ? 'error' : 'log', message: event.message });
            } else if ('message' in event && event.message) {
              const kind = event.type === 'result' ? 'result' : 'status';
              const ok = event.type === 'result' && 'row' in event ? (event.row as { status: string }).status === 'success' : undefined;
              appendRenewLog({ kind, ok, message: event.message });
            }
      });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        toast.error(error instanceof Error ? error.message : 'Renew & reset failed');
      }
    } finally {
      setRenewRunning(false);
      setRenewStopping(false);
      renewAbortRef.current = null;
    }
  }

  async function stopRenewReset() {
    if (!renewRunning || renewStopping) return;
    setRenewStopping(true);
    try {
      const res = await fetch('/api/editown/renew-reset', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to stop');
      appendRenewLog({ kind: 'log', message: 'Stopping…' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to stop');
      setRenewStopping(false);
      return;
    }
    renewAbortRef.current?.abort();
  }

  useEffect(() => {
    if (!autoRun || startedRef.current || rows.length === 0) {
      return;
    }
    startedRef.current = true;
    void run();
    // autoRun only matters on first load of this page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, rows.length]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm">
            <span className="uppercase tracking-wide text-gray-500">Pending</span>
            <span className="ml-2 text-lg font-semibold text-white">{pendingCount}</span>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm">
            <span className="uppercase tracking-wide text-gray-500">Completed</span>
            <span className="ml-2 text-lg font-semibold text-white">{stats?.completed ?? doneSummary?.completed ?? 0}</span>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm">
            <span className="uppercase tracking-wide text-gray-500">Success</span>
            <span className="ml-2 text-lg font-semibold text-emerald-400">{stats?.succeeded ?? successCount}</span>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm">
            <span className="uppercase tracking-wide text-gray-500">Failed</span>
            <span className="ml-2 text-lg font-semibold text-red-400">{stats?.failed ?? failedCount}</span>
          </div>
          <div className="ml-auto rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm text-right">
            <span className="uppercase tracking-wide text-gray-500">Mode</span>
            <span className="ml-2 text-sm font-medium text-gray-100">{running ? 'Syncing queue' : 'Idle'}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={running ? stop : () => void run()}
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
            {stopping ? 'Stopping…' : running ? 'Stop' : `Sync all${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
          </button>

          {currentLabel && (
            <div className="min-w-0 flex-1 rounded-lg border border-sky-700/40 bg-sky-950/30 px-3 py-2 text-sm text-sky-200">
              <div className="text-[11px] uppercase tracking-wide text-sky-300/70">Current</div>
              <div className="mt-1 truncate">{currentLabel}</div>
            </div>
          )}
        </div>
      </div>

      {doneSummary && (
        <div className="rounded-lg border border-green-700/60 bg-green-900/20 px-4 py-3 text-sm text-green-400">
          Completed {doneSummary.completed} of {doneSummary.total} listings • success {doneSummary.succeeded} • failed {doneSummary.failed}
        </div>
      )}

      {recentResults.length > 0 && (
        <div className="rounded-lg border border-gray-700 bg-gray-900/70 overflow-hidden">
          <div className="border-b border-gray-700 px-4 py-3 text-sm font-medium text-gray-300">Recent results</div>
          <div className="divide-y divide-gray-800">
            {recentResults.map((row) => (
              <div key={row.backup_id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate text-gray-200">{labelForRow(row)}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {row.mobile_id ? `mobile.bg #${row.mobile_id}` : `backup ${row.backup_id}`}
                    {row.completedAt ? ` • ${formatDate(row.completedAt)}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {row.runError && <div className="max-w-xs truncate text-xs text-red-300">{row.runError}</div>}
                  <SyncBadge status={row.runStatus} error={row.runError} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-700/60">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/70 text-xs uppercase tracking-wider text-gray-400">
            <tr>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Listing</th>
              <th className="px-3 py-2 text-left">Changes</th>
              <th className="px-3 py-2 text-left">Dealer</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-right">Updated</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50 bg-gray-900/40">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                  No changed listings are waiting for sync.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const changes = buildChangeRows(row);
              const canRevert = !running && row.needs_sync === 1 && changes.length > 0;

              return (
              <tr key={row.backup_id} className="align-top">
                <td className="px-3 py-3">
                  <div className="space-y-1">
                    <SyncBadge status={row.runStatus} error={row.runError} />
                    {row.runError && (
                      <div className="max-w-xs text-xs text-red-300">{row.runError}</div>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="font-medium text-white">{row.make ?? '—'} {row.model ?? ''}</div>
                  <div className="text-xs text-gray-400">{row.title || '—'}</div>
                  <div className="text-[11px] text-gray-500">mobile.bg #{row.mobile_id}</div>
                </td>
                <td className="px-3 py-3">
                  {changes.length > 0 ? (
                    <div className="space-y-1 text-xs">
                      {changes.map((change) => (
                        <div key={change.label}>
                          <div>
                            <span className="text-gray-500">{change.label}:</span>{' '}
                            <span className="text-gray-400">{change.oldValue}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">→</span>{' '}
                            <span className="text-gray-200">{change.newValue}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-600">No pending field changes</span>
                  )}
                </td>
                <td className="px-3 py-3 text-gray-300">{row.dealer_name ?? '—'}</td>
                <td className="px-3 py-3 text-right">
                  <div className="font-medium text-green-400">
                    {formatPrice(row.current_price)}
                  </div>
                  {getPriceWithVat(row.current_price, row.vat) != null && (
                    <div className="text-xs text-emerald-200/85">
                      {formatPrice(getPriceWithVat(row.current_price, row.vat))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-right text-xs text-gray-400">
                  {row.completedAt ? formatDate(row.completedAt) : '—'}
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    onClick={() => void revertDraft(row)}
                    disabled={!canRevert || revertingId === row.backup_id}
                    className="rounded-md border border-gray-700 px-2.5 py-1 text-xs text-gray-200 hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {revertingId === row.backup_id ? 'Reverting…' : 'Revert'}
                  </button>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {logs.length > 0 && (
        <LogPanel entries={logs} panelRef={logRef} />
      )}

      {ownDealers.length > 0 && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            {renewStats && (
              <>
                <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm">
                  <span className="uppercase tracking-wide text-gray-500">Total</span>
                  <span className="ml-2 text-lg font-semibold text-white">{renewStats.total}</span>
                </div>
                <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm">
                  <span className="uppercase tracking-wide text-gray-500">Success</span>
                  <span className="ml-2 text-lg font-semibold text-emerald-400">{renewStats.succeeded}</span>
                </div>
                <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm">
                  <span className="uppercase tracking-wide text-gray-500">Failed</span>
                  <span className="ml-2 text-lg font-semibold text-red-400">{renewStats.failed}</span>
                </div>
              </>
            )}
            <div className="ml-auto rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm text-right">
              <span className="uppercase tracking-wide text-gray-500">Mode</span>
              <span className="ml-2 text-sm font-medium text-gray-100">{renewRunning ? 'Running' : 'Idle'}</span>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-300">
              <span>Dealers</span>
              <span className="text-xs text-gray-500">({renewDealers.length} selected)</span>
              <button
                type="button"
                onClick={() => setRenewDealers(renewDealers.length === ownDealers.length ? [] : ownDealers.map((d) => d.slug))}
                disabled={renewRunning}
                className="text-xs font-medium text-blue-400 transition-colors hover:text-blue-300 disabled:cursor-not-allowed disabled:text-gray-600"
              >
                {renewDealers.length === ownDealers.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {ownDealers.map((d) => (
                <label key={d.slug} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={renewDealers.includes(d.slug)}
                    onChange={() => setRenewDealers((prev) => prev.includes(d.slug) ? prev.filter((s) => s !== d.slug) : [...prev, d.slug])}
                    disabled={renewRunning}
                    className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-200">{d.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={renewRunning ? stopRenewReset : () => void runRenewReset()}
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
              {renewStopping ? 'Stopping…' : renewRunning ? 'Stop' : renewOnlyReset ? 'Reset views' : 'Renew & Reset'}
            </button>

            <div
              onClick={() => !renewRunning && setRenewOnlyReset((v) => !v)}
              className={`flex items-center gap-3 ${renewRunning ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            >
              <div
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${renewOnlyReset ? 'bg-blue-600' : 'bg-gray-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${renewOnlyReset ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
              <span className="text-sm font-medium text-gray-200">Only reset views</span>
            </div>
          </div>

          {renewDone && (
            <div className="rounded-lg border border-green-700/60 bg-green-900/20 px-4 py-3 text-sm text-green-400">
              Done — {renewOnlyReset ? 'reset' : 'renewed'} {renewDone.succeeded}, failed {renewDone.failed}
            </div>
          )}

          {renewLogs.length > 0 && (
            <LogPanel entries={renewLogs} panelRef={renewLogRef} keyPrefix="renew" />
          )}
        </div>
      )}
    </div>
  );
}
