'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { EditOwnSyncRow } from '@/lib/queries';
import { formatDate, formatPrice } from '@/lib/utils';
import { getPriceWithVat } from '@/lib/vat';

interface Props {
  initialRows: EditOwnSyncRow[];
  autoRun?: boolean;
}

type BatchRow = EditOwnSyncRow & {
  runStatus: string | null;
  runError: string | null;
  completedAt: string | null;
};

type StreamEntry =
  | {
      type: 'start';
      total: number;
      completed: number;
      succeeded: number;
      failed: number;
      message?: string;
    }
  | {
      type: 'checking';
      total: number;
      completed: number;
      succeeded: number;
      failed: number;
      target: {
        backup_id: number;
        mobile_id: string | null;
        title: string | null;
        make: string | null;
        model: string | null;
        dealer_name: string | null;
        dealer_slug: string;
      };
      message?: string;
    }
  | {
      type: 'result';
      total: number;
      completed: number;
      succeeded: number;
      failed: number;
      row: {
        backup_id: number;
        mobile_id: string | null;
        status: 'success' | 'failed';
        completed_at: string;
        error: string | null;
      };
      message?: string;
    }
  | {
      type: 'complete';
      total: number;
      completed: number;
      succeeded: number;
      failed: number;
      message?: string;
    }
  | {
      type: 'log';
      level?: 'info' | 'stderr';
      backup_id?: number;
      message?: string;
    }
  | {
      type: 'error';
      message?: string;
    }
  | {
      type: 'stream_closed';
      code?: number | null;
    };

interface RunStats {
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
}

interface LogEntry {
  kind: 'status' | 'result' | 'log' | 'error';
  message: string;
  ok?: boolean;
}

function formatVatLabel(value: string | null) {
  if (value === 'included') return 'има';
  if (value === 'exempt') return 'няма';
  if (value === 'excluded') return '+ДДС';
  return '—';
}

function buildChangeRows(row: EditOwnSyncRow) {
  const changes: Array<{ label: string; oldValue: string; newValue: string }> = [];

  if ((row.source_title ?? '') !== (row.title ?? '')) {
    changes.push({
      label: 'Title',
      oldValue: row.source_title || '—',
      newValue: row.title || '—',
    });
  }

  if ((row.source_price ?? null) !== (row.current_price ?? null)) {
    changes.push({
      label: 'Price',
      oldValue: row.source_price != null ? formatPrice(row.source_price) : '—',
      newValue: row.current_price != null ? formatPrice(row.current_price) : '—',
    });
  }

  if ((row.source_vat ?? null) !== (row.vat ?? null)) {
    changes.push({
      label: 'VAT',
      oldValue: formatVatLabel(row.source_vat),
      newValue: formatVatLabel(row.vat),
    });
  }

  if ((row.source_ad_status ?? 'none') !== (row.ad_status ?? 'none')) {
    changes.push({
      label: 'Paid',
      oldValue: row.source_ad_status || 'none',
      newValue: row.ad_status || 'none',
    });
  }

  if ((row.source_kaparo ?? 0) !== (row.kaparo ?? 0)) {
    changes.push({
      label: 'К',
      oldValue: row.source_kaparo === 1 ? 'К' : '—',
      newValue: row.kaparo === 1 ? 'К' : '—',
    });
  }

  return changes;
}

function toBatchRow(row: EditOwnSyncRow): BatchRow {
  return {
    ...row,
    runStatus: row.last_mobile_sync_status ?? (row.needs_sync === 1 ? 'pending' : null),
    runError: row.last_mobile_sync_error,
    completedAt: row.last_mobile_sync_at,
  };
}

function SyncBadge({ status, error }: { status: string | null; error: string | null }) {
  if (status === 'running') {
    return <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-200">running</span>;
  }
  if (status === 'success') {
    return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-200">success</span>;
  }
  if (status === 'failed') {
    return (
      <span
        className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] text-red-200"
        title={error || 'Sync failed'}
      >
        failed
      </span>
    );
  }
  if (status === 'pending') {
    return <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[11px] text-blue-200">pending</span>;
  }
  return <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[11px] text-gray-400">idle</span>;
}

function labelForRow(row: Pick<BatchRow, 'make' | 'model' | 'title' | 'mobile_id' | 'backup_id'>) {
  return [row.make, row.model, row.title].filter(Boolean).join(' ') || row.mobile_id || `backup ${row.backup_id}`;
}

export default function EditOwnBatchSync({ initialRows, autoRun = false }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<BatchRow[]>(() => initialRows.map(toBatchRow));
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [doneSummary, setDoneSummary] = useState<RunStats | null>(null);
  const [revertingId, setRevertingId] = useState<number | null>(null);
  const startedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const pendingCount = rows.filter((row) => row.needs_sync === 1).length;
  const successCount = rows.filter((row) => row.runStatus === 'success').length;
  const failedCount = rows.filter((row) => row.runStatus === 'failed').length;

  const recentResults = useMemo(
    () => rows.filter((row) => row.runStatus === 'success' || row.runStatus === 'failed').slice().reverse().slice(0, 12),
    [rows],
  );

  async function revertDraft(row: BatchRow) {
    setRevertingId(row.backup_id);
    try {
      const res = await fetch(`/api/editown/sync-drafts/${row.backup_id}`, { method: 'POST' });
      const data = await res.json().catch(() => null) as EditOwnSyncRow | { error?: string } | null;
      if (!res.ok || !data || 'error' in data) {
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
      let message = 'Failed to start batch sync';
      try {
        const data = await res.json();
        message = data.error || message;
      } catch {
        // ignore JSON parse failure
      }
      toast.error(message);
      setLogs([{ kind: 'error', message }]);
      setRunning(false);
      setStopping(false);
      abortRef.current = null;
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';

        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith('data: ')) continue;

          try {
            const event = JSON.parse(line.slice(6)) as StreamEntry;

            if (event.type === 'start') {
              setStats({
                total: event.total,
                completed: event.completed,
                succeeded: event.succeeded,
                failed: event.failed,
              });
              if (event.message) setLogs((prev) => [...prev, { kind: 'status', message: event.message }]);
              continue;
            }

            if (event.type === 'checking') {
              setStats({
                total: event.total,
                completed: event.completed,
                succeeded: event.succeeded,
                failed: event.failed,
              });
              setCurrentLabel(labelForRow(event.target));
              setRows((prev) => prev.map((row) => row.backup_id === event.target.backup_id ? {
                ...row,
                runStatus: 'running',
                runError: null,
              } : row));
              if (event.message) setLogs((prev) => [...prev, { kind: 'status', message: event.message }]);
              continue;
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
                setLogs((prev) => [...prev, {
                  kind: 'result',
                  ok: event.row.status === 'success',
                  message: event.message,
                }]);
              }
              continue;
            }

            if (event.type === 'log') {
              if (event.message) {
                setLogs((prev) => [...prev, {
                  kind: event.level === 'stderr' ? 'error' : 'log',
                  message: event.message,
                }]);
              }
              continue;
            }

            if (event.type === 'error') {
              const message = event.message || 'Batch sync failed';
              setLogs((prev) => [...prev, { kind: 'error', message }]);
              toast.error(message);
              continue;
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
              if (event.message) setLogs((prev) => [...prev, { kind: 'status', message: event.message }]);
              if (event.failed === 0) {
                toast.success(`Synced ${event.succeeded} listing${event.succeeded === 1 ? '' : 's'} to mobile.bg`);
              } else {
                toast.error(`Synced ${event.succeeded}, ${event.failed} failed`);
              }
              router.refresh();
              continue;
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        const message = error instanceof Error ? error.message : 'Batch sync failed';
        setLogs((prev) => [...prev, { kind: 'error', message }]);
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
      setLogs((prev) => [...prev, { kind: 'log', message: 'Stopping batch sync…' }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop batch sync';
      setLogs((prev) => [...prev, { kind: 'error', message }]);
      toast.error(message);
      setStopping(false);
      return;
    }

    abortRef.current?.abort();
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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Batch Sync</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-400">
              Runs the mobile.bg sync for changed own listings and streams each step live while the queue is processed.
            </p>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-3 text-right">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Mode</div>
            <div className="mt-1 text-sm font-medium text-gray-100">
              {running ? 'Syncing queue' : 'Idle'}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Pending</div>
            <div className="mt-1 text-2xl font-semibold text-white">{pendingCount}</div>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Completed</div>
            <div className="mt-1 text-2xl font-semibold text-white">{stats?.completed ?? doneSummary?.completed ?? 0}</div>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Success</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-400">{stats?.succeeded ?? successCount}</div>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Failed</div>
            <div className="mt-1 text-2xl font-semibold text-red-400">{stats?.failed ?? failedCount}</div>
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

          <Link
            href="/editown"
            className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:border-gray-500 hover:text-white"
          >
            Back to editown
          </Link>

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
        <div
          ref={logRef}
          className="rounded-lg border border-gray-700 bg-gray-900 p-3 space-y-1 max-h-[420px] overflow-y-auto"
        >
          {logs.map((entry, index) => (
            <div
              key={`${index}-${entry.message}`}
              className={
                entry.kind === 'error'
                  ? 'text-xs py-0.5 font-mono text-red-400'
                  : entry.kind === 'result'
                  ? `text-xs py-0.5 font-mono ${entry.ok ? 'text-emerald-300' : 'text-red-300'}`
                  : entry.kind === 'status'
                  ? 'text-xs py-0.5 font-mono text-sky-300'
                  : 'text-xs py-0.5 font-mono text-gray-400'
              }
            >
              {entry.kind === 'error' ? '❌ ' : entry.kind === 'result' ? (entry.ok ? '✓ ' : '✕ ') : ''}
              {entry.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
