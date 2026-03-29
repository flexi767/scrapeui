'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { EditOwnSyncRow } from '@/lib/queries';
import { formatPrice, formatDate } from '@/lib/utils';

interface Props {
  initialRows: EditOwnSyncRow[];
  autoRun?: boolean;
}

type BatchRow = EditOwnSyncRow & {
  runStatus: string | null;
  runError: string | null;
  completedAt: string | null;
};

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

export default function EditOwnBatchSync({ initialRows, autoRun = false }: Props) {
  const [rows, setRows] = useState<BatchRow[]>(() => initialRows.map(toBatchRow));
  const [runningAll, setRunningAll] = useState(false);
  const startedRef = useRef(false);

  const pendingCount = rows.filter((row) => row.needs_sync === 1).length;
  const successCount = rows.filter((row) => row.runStatus === 'success').length;
  const failedCount = rows.filter((row) => row.runStatus === 'failed').length;

  async function syncOne(row: BatchRow): Promise<boolean> {
    setRows((prev) => prev.map((item) => item.backup_id === row.backup_id ? {
      ...item,
      runStatus: 'running',
      runError: null,
    } : item));

    try {
      const res = await fetch('/api/mobilebg/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealerSlug: row.dealer_slug, backupId: row.backup_id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.error || 'Sync failed';
        setRows((prev) => prev.map((item) => item.backup_id === row.backup_id ? {
          ...item,
          runStatus: 'failed',
          runError: message,
        } : item));
        return false;
      }

      const completedAt = new Date().toISOString();
      setRows((prev) => prev.map((item) => item.backup_id === row.backup_id ? {
        ...item,
        needs_sync: 0,
        runStatus: 'success',
        runError: null,
        completedAt,
      } : item));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      setRows((prev) => prev.map((item) => item.backup_id === row.backup_id ? {
        ...item,
        runStatus: 'failed',
        runError: message,
      } : item));
      return false;
    }
  }

  async function handleSyncAll() {
    const queue = rows.filter((row) => row.needs_sync === 1);
    if (queue.length === 0) {
      toast.message('No changed listings to sync');
      return;
    }

    setRunningAll(true);
    let succeeded = 0;
    let failed = 0;

    for (const row of queue) {
      // Sequential sync keeps Mobile.bg form automation stable.
      const ok = await syncOne(row);
      if (ok) {
        succeeded += 1;
      } else {
        failed += 1;
      }
    }

    setRunningAll(false);

    if (failed === 0) {
      toast.success(`Synced ${succeeded} listings to mobile.bg`);
      return;
    }

    toast.error(`Synced ${succeeded} listings, ${failed} failed`);
  }

  useEffect(() => {
    if (!autoRun || startedRef.current || rows.length === 0) {
      return;
    }
    startedRef.current = true;
    void handleSyncAll();
    // autoRun only matters on first load of this page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, rows.length]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-700/60 bg-gray-900/60 px-4 py-3">
        <div>
          <div className="text-sm font-medium text-white">Batch sync</div>
          <div className="text-xs text-gray-400">
            {pendingCount} pending, {successCount} success, {failedCount} failed
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/editown"
            className="rounded-md border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:border-gray-500 hover:text-white"
          >
            Back to editown
          </Link>
          <button
            onClick={() => void handleSyncAll()}
            disabled={runningAll || pendingCount === 0}
            className="rounded-md border border-blue-500/60 bg-blue-500/10 px-3 py-1.5 text-sm font-medium text-blue-200 hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {runningAll ? 'Syncing…' : `Sync all${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-700/60">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/70 text-xs uppercase tracking-wider text-gray-400">
            <tr>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Listing</th>
              <th className="px-3 py-2 text-left">Dealer</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-right">Updated</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50 bg-gray-900/40">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                  No changed listings are waiting for sync.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const isRunning = row.runStatus === 'running';
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
                  <td className="px-3 py-3 text-gray-300">{row.dealer_name ?? '—'}</td>
                  <td className="px-3 py-3 text-right font-medium text-green-400">
                    {formatPrice(row.current_price)}
                  </td>
                  <td className="px-3 py-3 text-right text-xs text-gray-400">
                    {row.completedAt ? formatDate(row.completedAt) : '—'}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      onClick={() => void syncOne(row)}
                      disabled={isRunning || runningAll || row.needs_sync !== 1}
                      className="rounded-md border border-gray-700 px-2.5 py-1 text-xs text-gray-200 hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isRunning ? 'Running…' : row.runStatus === 'failed' ? 'Retry' : 'Sync'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
