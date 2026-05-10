'use client';

import { useEffectEvent, useMemo, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { EditOwnSyncRow } from '@/lib/queries';
import { streamJsonEvents } from '@/lib/streaming-job';
import { errorMessage } from '@/lib/utils';
import { revertDraftToSource, startBatchSync, stopBatchSync } from './api';
import { useAutoScroll } from './useAutoScroll';
import {
  applyRowResult,
  countBatchRows,
  labelForRow,
  markRowRunning,
  prepareRowsForRun,
  recentCompletedRows,
  statsFromStreamEvent,
  toBatchRow,
} from './helpers';
import type { BatchRow, LogEntry, RunStats, StreamEntry } from './types';

export function useBatchSync(initialRows: EditOwnSyncRow[], autoRun: boolean) {
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

  useAutoScroll(logRef, logs);

  const rowCounts = useMemo(() => countBatchRows(rows), [rows]);
  const recentResults = useMemo(() => recentCompletedRows(rows), [rows]);

  const appendLog = (entry: LogEntry) => setLogs((prev) => [...prev, entry]);

  async function revertDraft(row: BatchRow) {
    setRevertingId(row.backup_id);
    try {
      const data = await revertDraftToSource(row.backup_id);
      setRows((prev) => prev.map((entry) => entry.backup_id === row.backup_id ? toBatchRow(data) : entry));
      toast.success('Draft reverted to original listing values');
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
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
    setStats({ total: rowCounts.pending, completed: 0, succeeded: 0, failed: 0 });
    setRows(prepareRowsForRun);

    const abortController = new AbortController();
    abortRef.current = abortController;

    let res: Response;
    try {
      res = await startBatchSync(abortController.signal);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setRunning(false);
        setStopping(false);
        abortRef.current = null;
        return;
      }
      const message = errorMessage(error);
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
          setStats(statsFromStreamEvent(event));
          if (event.message) appendLog({ kind: 'status', message: event.message });
          return;
        }
        if (event.type === 'checking') {
          setStats(statsFromStreamEvent(event));
          setCurrentLabel(labelForRow({ ...event.target, mobile_id: event.target.mobile_id }));
          setRows((prev) => markRowRunning(prev, event.target.backup_id));
          if (event.message) appendLog({ kind: 'status', message: event.message });
          return;
        }
        if (event.type === 'result') {
          setStats(statsFromStreamEvent(event));
          setRows((prev) => applyRowResult(prev, event.row));
          if (event.message) {
            appendLog({ kind: 'result', ok: event.row.status === 'success', message: event.message });
          }
          return;
        }
        if (event.type === 'log') {
          if (event.message) {
            appendLog({ kind: event.level === 'stderr' ? 'error' : 'log', message: event.message });
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
          const summary = statsFromStreamEvent(event);
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
        }
      });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        const message = errorMessage(error);
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
      await stopBatchSync();
      appendLog({ kind: 'log', message: 'Stopping batch sync…' });
    } catch (error) {
      const message = errorMessage(error);
      appendLog({ kind: 'error', message });
      toast.error(message);
      setStopping(false);
      return;
    }
    abortRef.current?.abort();
  }

  const runInitialBatchSync = useEffectEvent(() => { void run(); });
  useEffect(() => {
    if (!autoRun || startedRef.current || rows.length === 0) return;
    startedRef.current = true;
    runInitialBatchSync();
  }, [autoRun, rows.length]);

  return { rows, running, stopping, stats, currentLabel, logs, doneSummary, revertingId, rowCounts, recentResults, logRef, run, stop, revertDraft };
}
