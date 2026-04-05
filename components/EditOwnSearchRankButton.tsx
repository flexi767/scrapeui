'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

type RankLogLevel = 'stderr' | 'info';

interface RankStats {
  total: number;
  checked: number;
  found: number;
  notFound: number;
}

interface RankTarget {
  backup_id: number;
  listing_id: number;
  mobile_id: string | null;
  title: string | null;
  make: string | null;
  model: string | null;
}

interface RankRow {
  backup_id: number;
  listing_id: number;
  mobile_id: string | null;
  title: string | null;
  make: string | null;
  model: string | null;
  checked_at: string;
  original_position: number | null;
  price_position: number | null;
  first_result_price: number | null;
  found: boolean;
}

type StreamEntry =
  | {
      type: 'start';
      stats: RankStats;
      missingOnly: boolean;
      message?: string;
    }
  | {
      type: 'checking';
      stats: RankStats;
      target: RankTarget;
      message?: string;
    }
  | {
      type: 'result';
      stats: RankStats;
      row: RankRow;
      message?: string;
    }
  | {
      type: 'complete';
      total: number;
      found: number;
      notFound: number;
      rows: RankRow[];
      message?: string;
      code?: number | null;
    }
  | {
      type: 'log';
      level?: RankLogLevel;
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

interface DisplayLogEntry {
  kind: 'status' | 'result' | 'log' | 'error';
  message: string;
  found?: boolean;
}

function labelForTarget(target: RankTarget) {
  return [target.make, target.model, target.title].filter(Boolean).join(' ') || target.mobile_id || `listing ${target.listing_id}`;
}

function labelForRow(row: RankRow) {
  return [row.make, row.model, row.title].filter(Boolean).join(' ') || row.mobile_id || `listing ${row.listing_id}`;
}

export default function EditOwnSearchRankButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [activeMode, setActiveMode] = useState<'all' | 'missing' | null>(null);
  const [logs, setLogs] = useState<DisplayLogEntry[]>([]);
  const [stats, setStats] = useState<RankStats | null>(null);
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);
  const [doneSummary, setDoneSummary] = useState<{ total: number; found: number; notFound: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function run(missingOnly = false) {
    setRunning(true);
    setStopping(false);
    setActiveMode(missingOnly ? 'missing' : 'all');
    setLogs([]);
    setStats(null);
    setCurrentLabel(null);
    setDoneSummary(null);

    const abortController = new AbortController();
    abortRef.current = abortController;

    let res: Response;
    try {
      res = await fetch('/api/editown/search-ranks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missingOnly }),
        signal: abortController.signal,
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setRunning(false);
        setStopping(false);
        setActiveMode(null);
        abortRef.current = null;
        return;
      }
      toast.error(error instanceof Error ? error.message : 'Search check failed');
      setRunning(false);
      setStopping(false);
      setActiveMode(null);
      abortRef.current = null;
      return;
    }

    if (!res.ok || !res.body) {
      let message = 'Failed to start search-position run';
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
      setActiveMode(null);
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
              setStats(event.stats);
              if (event.message) setLogs((prev) => [...prev, { kind: 'status', message: event.message }]);
              continue;
            }

            if (event.type === 'checking') {
              setStats(event.stats);
              setCurrentLabel(labelForTarget(event.target));
              if (event.message) setLogs((prev) => [...prev, { kind: 'status', message: event.message }]);
              continue;
            }

            if (event.type === 'result') {
              setStats(event.stats);
              setCurrentLabel(labelForRow(event.row));
              setLogs((prev) => [
                ...prev,
                {
                  kind: 'result',
                  found: event.row.found,
                  message: event.message || labelForRow(event.row),
                },
              ]);
              continue;
            }

            if (event.type === 'log') {
              if (event.message) {
                setLogs((prev) => [...prev, { kind: 'log', message: event.message }]);
              }
              continue;
            }

            if (event.type === 'error') {
              const message = event.message || 'Search-position run failed';
              setLogs((prev) => [...prev, { kind: 'error', message }]);
              toast.error(message);
              continue;
            }

            if (event.type === 'complete') {
              setDoneSummary({ total: event.total, found: event.found, notFound: event.notFound });
              setCurrentLabel(null);
              setRunning(false);
              setStopping(false);
              setActiveMode(null);
              abortRef.current = null;
              toast.success(`Checked ${event.total} listings • found ${event.found} • missing ${event.notFound}`);
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
        const message = error instanceof Error ? error.message : 'Search-position run failed';
        setLogs((prev) => [...prev, { kind: 'error', message }]);
        toast.error(message);
      }
    } finally {
      setRunning(false);
      setStopping(false);
      setActiveMode(null);
      abortRef.current = null;
      setCurrentLabel(null);
    }
  }

  async function stop() {
    if (!running || stopping) return;
    setStopping(true);

    try {
      const res = await fetch('/api/editown/search-ranks', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to stop search-position run');
      }
      setLogs((prev) => [...prev, { kind: 'log', message: 'Stopping search-position run…' }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop search-position run';
      setLogs((prev) => [...prev, { kind: 'error', message }]);
      toast.error(message);
      setStopping(false);
      return;
    }

    abortRef.current?.abort();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={running ? stop : () => void run(false)}
          disabled={stopping}
          className={`rounded border px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${
            running
              ? 'border-red-500/60 bg-red-500/20 hover:bg-red-500/30'
              : 'border-amber-500/60 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15'
          }`}
        >
          {stopping ? 'Stopping…' : running ? 'Stop' : 'Check search positions'}
        </button>
        <button
          onClick={() => void run(true)}
          disabled={running}
          className="rounded border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Missing only
        </button>
      </div>

      {(running || logs.length > 0 || doneSummary) && (
        <div className="w-[420px] rounded-lg border border-gray-700 bg-gray-900/90 p-3 text-xs text-gray-300 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium text-gray-100">
              {running
                ? activeMode === 'missing'
                  ? 'Checking missing search positions'
                  : 'Checking search positions'
                : 'Last search-position run'}
            </div>
            {stats && (
              <div className="text-[11px] text-gray-400">
                {stats.checked}/{stats.total} • found {stats.found} • missing {stats.notFound}
              </div>
            )}
          </div>

          {currentLabel && (
            <div className="mt-2 truncate rounded bg-gray-800/80 px-2 py-1 text-[11px] text-sky-200" title={currentLabel}>
              {currentLabel}
            </div>
          )}

          {doneSummary && !running && (
            <div className="mt-2 rounded border border-emerald-700/50 bg-emerald-900/20 px-2 py-1 text-[11px] text-emerald-200">
              Checked {doneSummary.total} listings • found {doneSummary.found} • missing {doneSummary.notFound}
            </div>
          )}

          <div className="mt-2 max-h-52 overflow-y-auto rounded border border-gray-800 bg-gray-950/70 px-2 py-1.5">
            {logs.length === 0 ? (
              <div className="text-[11px] text-gray-500">Waiting for progress…</div>
            ) : (
              <div className="space-y-1">
                {logs.map((entry, index) => (
                  <div
                    key={`${index}-${entry.message}`}
                    className={
                      entry.kind === 'error'
                        ? 'text-[11px] text-red-300'
                        : entry.kind === 'result'
                        ? `text-[11px] ${entry.found ? 'text-emerald-200' : 'text-red-300'}`
                        : entry.kind === 'status'
                        ? 'text-[11px] text-sky-200'
                        : 'text-[11px] text-gray-400'
                    }
                  >
                    {entry.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
