'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { EditOwnSyncRow } from '@/lib/queries';
import { streamJsonEvents } from '@/lib/streaming-job';
import {
  revertDraftToSource,
  startBatchSync,
  startRenewReset,
  stopBatchSync,
  stopRenewResetJob,
} from './edit-own-batch-sync/api';
import { BatchSyncPanel } from './edit-own-batch-sync/BatchSyncPanel';
import { ChangedListingsTable } from './edit-own-batch-sync/ChangedListingsTable';
import { LogPanel } from './edit-own-batch-sync/LogPanel';
import { RecentResults } from './edit-own-batch-sync/RecentResults';
import { RenewResetPanel } from './edit-own-batch-sync/RenewResetPanel';
import {
  labelForRow,
  statsFromStreamEvent,
  streamEventMessageKind,
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
  const runInitialBatchSync = useEffectEvent(() => {
    void run();
  });

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
      const data = await revertDraftToSource(row.backup_id);
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
      res = await startBatchSync(abortController.signal);
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
              setRows((prev) => prev.map((row) => row.backup_id === event.target.backup_id ? {
                ...row,
                runStatus: 'running',
                runError: null,
              } : row));
              if (event.message) appendLog({ kind: 'status', message: event.message });
              return;
            }

            if (event.type === 'result') {
              setStats(statsFromStreamEvent(event));
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
      await stopBatchSync();
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
      res = await startRenewReset({
        dealerSlugs: renewDealers,
        onlyReset: renewOnlyReset,
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

    try {
      await streamJsonEvents<StreamEntry>(res, (event) => {
            if (event.type === 'start' || event.type === 'checking' || event.type === 'result' || event.type === 'complete') {
              const s = statsFromStreamEvent(event);
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

            if ('message' in event && event.message) {
              const kind = streamEventMessageKind(event);
              const ok = event.type === 'result' ? event.row.status === 'success' : undefined;
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
      await stopRenewResetJob();
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
    runInitialBatchSync();
  }, [autoRun, rows.length]);

  return (
    <div className="space-y-6">
      <BatchSyncPanel
        currentLabel={currentLabel}
        doneSummary={doneSummary}
        failedCount={failedCount}
        pendingCount={pendingCount}
        running={running}
        stats={stats}
        stopping={stopping}
        successCount={successCount}
        onRunOrStop={running ? stop : () => void run()}
      />

      {doneSummary && (
        <div className="rounded-lg border border-green-700/60 bg-green-900/20 px-4 py-3 text-sm text-green-400">
          Completed {doneSummary.completed} of {doneSummary.total} listings • success {doneSummary.succeeded} • failed {doneSummary.failed}
        </div>
      )}

      <RecentResults rows={recentResults} />

      <ChangedListingsTable
        rows={rows}
        running={running}
        revertingId={revertingId}
        onRevert={(row) => void revertDraft(row)}
      />

      {logs.length > 0 && (
        <LogPanel entries={logs} panelRef={logRef} />
      )}

      <RenewResetPanel
        ownDealers={ownDealers}
        renewDealers={renewDealers}
        renewOnlyReset={renewOnlyReset}
        renewRunning={renewRunning}
        renewStopping={renewStopping}
        renewStats={renewStats}
        renewDone={renewDone}
        renewLogs={renewLogs}
        running={running}
        renewLogRef={renewLogRef}
        onToggleDealer={(slug) => setRenewDealers((prev) => prev.includes(slug) ? prev.filter((entry) => entry !== slug) : [...prev, slug])}
        onToggleAllDealers={() => setRenewDealers(renewDealers.length === ownDealers.length ? [] : ownDealers.map((dealer) => dealer.slug))}
        onToggleOnlyReset={() => setRenewOnlyReset((value) => !value)}
        onRunOrStop={renewRunning ? stopRenewReset : () => void runRenewReset()}
      />
    </div>
  );
}
