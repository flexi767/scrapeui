'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  thumb_url: string | null;
  listing_url: string | null;
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
  thumb_url: string | null;
  listing_url: string | null;
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
  thumbUrl?: string | null;
  listingUrl?: string | null;
  originalPosition?: number | null;
  pricePosition?: number | null;
}

function labelForTarget(target: RankTarget) {
  return [target.make, target.model, target.title].filter(Boolean).join(' ') || target.mobile_id || `listing ${target.listing_id}`;
}

function labelForRow(row: RankRow) {
  return [row.make, row.model, row.title].filter(Boolean).join(' ') || row.mobile_id || `listing ${row.listing_id}`;
}

function PreviewThumb({
  thumbUrl,
  listingUrl,
  label,
}: {
  thumbUrl: string | null;
  listingUrl: string | null;
  label: string;
}) {
  const content = thumbUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={thumbUrl}
      alt={label}
      className="h-14 w-[76px] rounded object-cover bg-gray-800"
      style={{ aspectRatio: '4/3' }}
    />
  ) : (
    <div className="flex h-14 w-[76px] items-center justify-center rounded bg-gray-800 text-[10px] uppercase tracking-wide text-gray-500">
      No image
    </div>
  );

  if (listingUrl) {
    return (
      <a href={listingUrl} className="shrink-0 transition-opacity hover:opacity-80">
        {content}
      </a>
    );
  }

  return <div className="shrink-0">{content}</div>;
}

export default function SearchPositionsRunner() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [activeMode, setActiveMode] = useState<'all' | 'missing' | null>(null);
  const [logs, setLogs] = useState<DisplayLogEntry[]>([]);
  const [stats, setStats] = useState<RankStats | null>(null);
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);
  const [currentPreview, setCurrentPreview] = useState<{ thumbUrl: string | null; listingUrl: string | null } | null>(null);
  const [doneSummary, setDoneSummary] = useState<{ total: number; found: number; notFound: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const resultRows = useMemo(
    () => logs.filter((entry): entry is DisplayLogEntry & { kind: 'result'; found: boolean } => entry.kind === 'result' && typeof entry.found === 'boolean'),
    [logs],
  );
  const appendLog = (entry: DisplayLogEntry) => setLogs((prev) => [...prev, entry]);

  async function run(missingOnly = false) {
    setRunning(true);
    setStopping(false);
    setActiveMode(missingOnly ? 'missing' : 'all');
    setLogs([]);
    setStats(null);
    setCurrentLabel(null);
    setCurrentPreview(null);
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
              if (event.message) appendLog({ kind: 'status', message: event.message });
              continue;
            }

            if (event.type === 'checking') {
              setStats(event.stats);
              setCurrentLabel(labelForTarget(event.target));
              setCurrentPreview({ thumbUrl: event.target.thumb_url, listingUrl: event.target.listing_url });
              if (event.message) appendLog({ kind: 'status', message: event.message });
              continue;
            }

            if (event.type === 'result') {
              setStats(event.stats);
              setCurrentLabel(labelForRow(event.row));
              setCurrentPreview({ thumbUrl: event.row.thumb_url, listingUrl: event.row.listing_url });
              appendLog({
                kind: 'result',
                found: event.row.found,
                message: labelForRow(event.row),
                thumbUrl: event.row.thumb_url,
                listingUrl: event.row.listing_url,
                originalPosition: event.row.original_position,
                pricePosition: event.row.price_position,
              });
              continue;
            }

            if (event.type === 'log') {
              if (event.message) {
                appendLog({ kind: 'log', message: event.message });
              }
              continue;
            }

            if (event.type === 'error') {
              const message = event.message || 'Search-position run failed';
              appendLog({ kind: 'error', message });
              toast.error(message);
              continue;
            }

            if (event.type === 'complete') {
              setDoneSummary({ total: event.total, found: event.found, notFound: event.notFound });
              setCurrentLabel(null);
              setCurrentPreview(null);
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
        appendLog({ kind: 'error', message });
        toast.error(message);
      }
    } finally {
      setRunning(false);
      setStopping(false);
      setActiveMode(null);
      abortRef.current = null;
      setCurrentLabel(null);
      setCurrentPreview(null);
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
      appendLog({ kind: 'log', message: 'Stopping search-position run…' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop search-position run';
      appendLog({ kind: 'error', message });
      toast.error(message);
      setStopping(false);
      return;
    }

    abortRef.current?.abort();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Check Search Positions</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-400">
              Runs the edit-own search-position checker and streams progress here while it updates found and missing ranks.
            </p>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-3 text-right">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Mode</div>
            <div className="mt-1 text-sm font-medium text-gray-100">
              {running
                ? activeMode === 'missing'
                  ? 'Missing only'
                  : 'All listings'
                : 'Idle'}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Total</div>
            <div className="mt-1 text-2xl font-semibold text-white">{stats?.total ?? doneSummary?.total ?? '—'}</div>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Checked</div>
            <div className="mt-1 text-2xl font-semibold text-white">{stats?.checked ?? doneSummary?.total ?? 0}</div>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Found</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-400">{stats?.found ?? doneSummary?.found ?? 0}</div>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Missing</div>
            <div className="mt-1 text-2xl font-semibold text-amber-300">{stats?.notFound ?? doneSummary?.notFound ?? 0}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={running ? stop : () => void run(false)}
            disabled={stopping}
            className={`flex items-center gap-2 rounded-md px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${
              running ? 'bg-red-600 hover:bg-red-500' : 'bg-amber-600 hover:bg-amber-500'
            }`}
          >
            {(running || stopping) && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {stopping ? 'Stopping…' : running ? 'Stop' : 'Check all'}
          </button>

          <button
            onClick={() => void run(true)}
            disabled={running}
            className="rounded-md border border-gray-600 px-5 py-2 text-sm font-semibold text-gray-200 transition-colors hover:border-gray-500 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Missing only
          </button>

          {currentLabel && (
            <div className="min-w-0 flex-1 rounded-lg border border-sky-700/40 bg-sky-950/30 px-3 py-2 text-sm text-sky-200">
              <div className="text-[11px] uppercase tracking-wide text-sky-300/70">Current</div>
              <div className="mt-2 flex items-center gap-3">
                <PreviewThumb
                  thumbUrl={currentPreview?.thumbUrl ?? null}
                  listingUrl={currentPreview?.listingUrl ?? null}
                  label={currentLabel}
                />
                <div className="min-w-0 truncate">{currentLabel}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {doneSummary && (
        <div className="rounded-lg border border-green-700/60 bg-green-900/20 px-4 py-3 text-sm text-green-400">
          Checked {doneSummary.total} listings • found {doneSummary.found} • missing {doneSummary.notFound}
        </div>
      )}

      {resultRows.length > 0 && (
        <div className="rounded-lg border border-gray-700 bg-gray-900/70 overflow-hidden">
          <div className="border-b border-gray-700 px-4 py-3 text-sm font-medium text-gray-300">Recent results</div>
          <div className="divide-y divide-gray-800">
            {resultRows.slice(-12).reverse().map((entry, index) => (
              <div key={`${index}-${entry.message}`} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <PreviewThumb
                    thumbUrl={entry.thumbUrl ?? null}
                    listingUrl={entry.listingUrl ?? null}
                    label={entry.message}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-gray-200">{entry.message}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {entry.found
                        ? `Orig #${entry.originalPosition ?? '—'} • Price #${entry.pricePosition ?? '—'}`
                        : 'Not found in search results'}
                    </div>
                  </div>
                </div>
                <div className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${entry.found ? 'bg-emerald-900/50 text-emerald-200' : 'bg-amber-900/40 text-amber-200'}`}>
                  {entry.found ? 'Found' : 'Missing'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {logs.length > 0 && (
        <div
          ref={logRef}
          className="rounded-lg border border-gray-700 bg-gray-900 p-3 space-y-1 max-h-[600px] overflow-y-auto"
        >
          {logs.map((entry, index) => (
            <div
              key={`${index}-${entry.message}`}
              className={
                entry.kind === 'error'
                  ? 'text-xs py-0.5 font-mono text-red-400'
                  : entry.kind === 'result'
                  ? `text-xs py-0.5 font-mono ${entry.found ? 'text-emerald-300' : 'text-amber-300'}`
                  : entry.kind === 'status'
                  ? 'text-xs py-0.5 font-mono text-sky-300'
                  : 'text-xs py-0.5 font-mono text-gray-400'
              }
            >
              {entry.kind === 'error' ? '❌ ' : entry.kind === 'result' ? (entry.found ? '✓ ' : '• ') : ''}
              {entry.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
