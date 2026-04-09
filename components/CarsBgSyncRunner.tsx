'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import type { DealerRow } from '@/lib/queries';

type StreamEntry =
  | { type: 'start'; message?: string; dryRun: boolean }
  | { type: 'dealer'; dealer: string; message?: string }
  | { type: 'summary'; dealer: string; missing: number; diffs: number; stale: number; dryRun: boolean }
  | { type: 'listing'; dealer: string; action: 'missing'; mobileId: string | null; carsId: string | null; make: string | null; model: string | null; title: string | null; price: number | null; url: string | null }
  | { type: 'diff'; dealer: string; action: 'price'; mobileId: string | null; carsId: string | null; make: string | null; model: string | null; title: string | null; oldPrice: number | null; newPrice: number | null; priceDiff?: boolean; titleDiff?: boolean; descriptionDiff?: boolean; url: string | null }
  | { type: 'stale'; dealer: string; carsId: string | null }
  | { type: 'done'; dealer: string; updated: number; created: number; deleted: number; failedUpdates: number; failedCreates: number; failedDeletes: number }
  | { type: 'end'; dryRun: boolean; missing: number; diffs: number; stale: number; updated: number; created: number; deleted: number; failedUpdates: number; failedCreates: number; failedDeletes: number; message?: string }
  | { type: 'log'; level?: 'stderr' | 'info'; dealer?: string; message?: string }
  | { type: 'error'; message?: string }
  | { type: 'stream_closed'; code?: number | null };

interface MissingItem {
  dealer: string;
  mobileId: string | null;
  carsId: string | null;
  make: string | null;
  model: string | null;
  title: string | null;
  price: number | null;
  url: string | null;
}

interface DiffItem {
  dealer: string;
  mobileId: string | null;
  carsId: string | null;
  make: string | null;
  model: string | null;
  title: string | null;
  oldPrice: number | null;
  newPrice: number | null;
  priceDiff?: boolean;
  titleDiff?: boolean;
  descriptionDiff?: boolean;
  url: string | null;
}

interface Totals {
  missing: number;
  diffs: number;
  stale: number;
  updated: number;
  created: number;
  deleted: number;
  failedUpdates: number;
  failedCreates: number;
  failedDeletes: number;
}

interface LogEntry {
  kind: 'status' | 'log' | 'error';
  message: string;
}

const ZERO_TOTALS: Totals = {
  missing: 0,
  diffs: 0,
  stale: 0,
  updated: 0,
  created: 0,
  deleted: 0,
  failedUpdates: 0,
  failedCreates: 0,
  failedDeletes: 0,
};

function listingLabel(item: { make: string | null; model: string | null; title: string | null; mobileId?: string | null; carsId?: string | null }) {
  return [item.make, item.model, item.title].filter(Boolean).join(' ') || item.mobileId || item.carsId || 'Listing';
}

interface Props {
  dealers: DealerRow[];
}

export default function CarsBgSyncRunner({ dealers }: Props) {
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [currentDealer, setCurrentDealer] = useState<string | null>(null);
  const [selectedDealers, setSelectedDealers] = useState<string[]>(() => dealers.map((dealer) => dealer.slug));
  const [totals, setTotals] = useState<Totals>(ZERO_TOTALS);
  const [doneSummary, setDoneSummary] = useState<Totals | null>(null);
  const [missing, setMissing] = useState<MissingItem[]>([]);
  const [diffs, setDiffs] = useState<DiffItem[]>([]);
  const [staleCarsIds, setStaleCarsIds] = useState<Array<{ dealer: string; carsId: string | null }>>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const hasPlan = missing.length > 0 || diffs.length > 0 || staleCarsIds.length > 0 || doneSummary !== null;

  const allSelected = selectedDealers.length === dealers.length;
  const appendLog = (entry: LogEntry) => setLogs((prev) => [...prev, entry]);

  function toggleDealer(slug: string) {
    setSelectedDealers((prev) => prev.includes(slug) ? prev.filter((entry) => entry !== slug) : [...prev, slug]);
  }

  async function run(live: boolean) {
    if (selectedDealers.length === 0) {
      toast.error('Select at least one dealer');
      return;
    }
    setRunning(true);
    setStopping(false);
    setLiveMode(live);
    setCurrentDealer(null);
    setTotals(ZERO_TOTALS);
    setDoneSummary(null);
    setMissing([]);
    setDiffs([]);
    setStaleCarsIds([]);
    setLogs([]);

    const abortController = new AbortController();
    abortRef.current = abortController;

    let res: Response;
    try {
      res = await fetch('/api/editown/carsbg-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ live, dealers: selectedDealers }),
        signal: abortController.signal,
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setRunning(false);
        setStopping(false);
        abortRef.current = null;
        return;
      }
      const message = error instanceof Error ? error.message : 'Cars.bg sync failed';
      setLogs([{ kind: 'error', message }]);
      toast.error(message);
      setRunning(false);
      setStopping(false);
      abortRef.current = null;
      return;
    }

    if (!res.ok || !res.body) {
      let message = 'Failed to start cars.bg sync';
      try {
        const data = await res.json();
        message = data.error || message;
      } catch {
        // ignore JSON parse failure
      }
      setLogs([{ kind: 'error', message }]);
      toast.error(message);
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
              if (event.message) appendLog({ kind: 'status', message: event.message });
              continue;
            }

            if (event.type === 'dealer') {
              setCurrentDealer(event.dealer);
              if (event.message) appendLog({ kind: 'status', message: event.message });
              continue;
            }

            if (event.type === 'summary') {
              setTotals((prev) => ({
                ...prev,
                missing: prev.missing + event.missing,
                diffs: prev.diffs + event.diffs,
                stale: prev.stale + event.stale,
              }));
              appendLog({
                kind: 'status',
                message: `${event.dealer}: ${event.missing} missing, ${event.diffs} diffs, ${event.stale} stale`,
              });
              continue;
            }

            if (event.type === 'listing') {
              setMissing((prev) => [...prev, {
                dealer: event.dealer,
                mobileId: event.mobileId,
                carsId: event.carsId,
                make: event.make,
                model: event.model,
                title: event.title,
                price: event.price,
                url: event.url,
              }]);
              continue;
            }

            if (event.type === 'diff') {
              setDiffs((prev) => [...prev, {
                dealer: event.dealer,
                mobileId: event.mobileId,
                carsId: event.carsId,
                make: event.make,
                model: event.model,
                title: event.title,
                oldPrice: event.oldPrice,
                newPrice: event.newPrice,
                priceDiff: event.priceDiff,
                titleDiff: event.titleDiff,
                descriptionDiff: event.descriptionDiff,
                url: event.url,
              }]);
              continue;
            }

            if (event.type === 'stale') {
              setStaleCarsIds((prev) => [...prev, { dealer: event.dealer, carsId: event.carsId }]);
              continue;
            }

            if (event.type === 'done') {
              setTotals((prev) => ({
                ...prev,
                updated: prev.updated + event.updated,
                created: prev.created + event.created,
                deleted: prev.deleted + event.deleted,
                failedUpdates: prev.failedUpdates + event.failedUpdates,
                failedCreates: prev.failedCreates + event.failedCreates,
                failedDeletes: prev.failedDeletes + event.failedDeletes,
              }));
              appendLog({
                kind: 'status',
                message: `${event.dealer}: ${event.updated} updated, ${event.created} created, ${event.deleted} deleted`,
              });
              continue;
            }

            if (event.type === 'log') {
              if (event.message) {
                appendLog({
                  kind: event.level === 'stderr' ? 'error' : 'log',
                  message: event.dealer ? `${event.dealer}: ${event.message}` : event.message,
                });
              }
              continue;
            }

            if (event.type === 'error') {
              const message = event.message || 'Cars.bg sync failed';
              appendLog({ kind: 'error', message });
              toast.error(message);
              continue;
            }

            if (event.type === 'end') {
              const summary: Totals = {
                missing: event.missing,
                diffs: event.diffs,
                stale: event.stale,
                updated: event.updated,
                created: event.created,
                deleted: event.deleted,
                failedUpdates: event.failedUpdates,
                failedCreates: event.failedCreates,
                failedDeletes: event.failedDeletes,
              };
              setDoneSummary(summary);
              setTotals(summary);
              setRunning(false);
              setStopping(false);
              setCurrentDealer(null);
              abortRef.current = null;
              if (event.message) appendLog({ kind: 'status', message: event.message });
              if (live) {
                if (event.failedUpdates + event.failedCreates + event.failedDeletes === 0) {
                  toast.success(`Cars.bg sync finished: ${event.updated} updated, ${event.created} created, ${event.deleted} deleted`);
                } else {
                  toast.error(`Cars.bg sync finished with failures`);
                }
              } else {
                toast.success(`Cars.bg plan ready: ${event.missing} missing, ${event.diffs} diffs, ${event.stale} stale`);
              }
              continue;
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        const message = error instanceof Error ? error.message : 'Cars.bg sync failed';
        appendLog({ kind: 'error', message });
        toast.error(message);
      }
    } finally {
      setRunning(false);
      setStopping(false);
      setCurrentDealer(null);
      abortRef.current = null;
    }
  }

  async function stop() {
    if (!running || stopping) return;
    setStopping(true);

    try {
      const res = await fetch('/api/editown/carsbg-sync', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to stop cars.bg sync');
      appendLog({ kind: 'log', message: 'Stopping cars.bg sync…' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop cars.bg sync';
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
            <h2 className="text-lg font-semibold text-white">Cars.bg Sync</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-400">
              Preview or run the Mobile.bg → Cars.bg sync for own dealers using the migrated cars.bg publish flow.
            </p>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-3 text-right">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">Mode</div>
            <div className="mt-1 text-sm font-medium text-gray-100">
              {running ? (liveMode ? 'Running live' : 'Planning') : (doneSummary ? (liveMode ? 'Last run live' : 'Last preview') : 'Idle')}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm">
            <span className="uppercase tracking-wide text-gray-500">Missing</span>
            <span className="ml-2 text-lg font-semibold text-white">{totals.missing}</span>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm">
            <span className="uppercase tracking-wide text-gray-500">Diffs</span>
            <span className="ml-2 text-lg font-semibold text-amber-300">{totals.diffs}</span>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm">
            <span className="uppercase tracking-wide text-gray-500">Stale</span>
            <span className="ml-2 text-lg font-semibold text-red-300">{totals.stale}</span>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm">
            <span className="uppercase tracking-wide text-gray-500">Updated</span>
            <span className="ml-2 text-lg font-semibold text-sky-300">{totals.updated}</span>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm">
            <span className="uppercase tracking-wide text-gray-500">Created</span>
            <span className="ml-2 text-lg font-semibold text-emerald-400">{totals.created}</span>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm">
            <span className="uppercase tracking-wide text-gray-500">Deleted</span>
            <span className="ml-2 text-lg font-semibold text-red-400">{totals.deleted}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={running ? stop : () => void run(false)}
            disabled={stopping}
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
            {stopping ? 'Stopping…' : running ? 'Stop' : 'Preview plan'}
          </button>

          <button
            onClick={() => void run(true)}
            disabled={running}
            className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Run live
          </button>

          {currentDealer && (
            <div className="min-w-0 flex-1 rounded-lg border border-sky-700/40 bg-sky-950/30 px-3 py-2 text-sm text-sky-200">
              <div className="text-[11px] uppercase tracking-wide text-sky-300/70">Current dealer</div>
              <div className="mt-1 truncate">{currentDealer}</div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-gray-200">Dealers</div>
              <div className="mt-1 text-xs text-gray-500">
                Select one or more own dealers for preview or live sync.
              </div>
            </div>
            <button
              type="button"
              disabled={running || dealers.length === 0}
              onClick={() => setSelectedDealers(allSelected ? [] : dealers.map((dealer) => dealer.slug))}
              className="rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {dealers.map((dealer) => {
              const selected = selectedDealers.includes(dealer.slug);
              return (
                <button
                  key={dealer.slug}
                  type="button"
                  disabled={running}
                  onClick={() => toggleDealer(dealer.slug)}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? 'border-sky-500 bg-sky-500/15 text-sky-200'
                      : 'border-gray-700 bg-gray-900/80 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                  }`}
                >
                  {dealer.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {doneSummary && (
        <div className="rounded-lg border border-green-700/60 bg-green-900/20 px-4 py-3 text-sm text-green-400">
          {liveMode
            ? `Live run finished • updated ${doneSummary.updated} • created ${doneSummary.created} • deleted ${doneSummary.deleted}`
            : `Plan ready • missing ${doneSummary.missing} • diffs ${doneSummary.diffs} • stale ${doneSummary.stale}`}
        </div>
      )}

      {hasPlan && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="overflow-hidden rounded-xl border border-gray-700/60">
            <div className="border-b border-gray-700/60 bg-gray-800/70 px-4 py-3 text-sm font-medium text-gray-200">
              Missing On Cars.bg
            </div>
            <div className="divide-y divide-gray-700/40 bg-gray-900/40">
              {missing.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500">No missing listings in the current plan.</div>
              ) : missing.map((item, index) => (
                <div key={`${item.mobileId || index}`} className="px-4 py-3 text-sm">
                  <div className="text-white">{listingLabel(item)}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {item.dealer}
                    {item.mobileId ? ` • mobile.bg #${item.mobileId}` : ''}
                    {item.price != null ? ` • ${formatPrice(item.price)}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-700/60">
            <div className="border-b border-gray-700/60 bg-gray-800/70 px-4 py-3 text-sm font-medium text-gray-200">
              Price Diffs
            </div>
            <div className="divide-y divide-gray-700/40 bg-gray-900/40">
              {diffs.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500">No price diffs in the current plan.</div>
              ) : diffs.map((item, index) => (
                <div key={`${item.mobileId || item.carsId || index}`} className="px-4 py-3 text-sm">
                  <div className="text-white">{listingLabel(item)}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {item.dealer}
                    {item.mobileId ? ` • mobile.bg #${item.mobileId}` : ''}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                    {item.priceDiff && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-200">price</span>
                    )}
                    {item.titleDiff && (
                      <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-200">title</span>
                    )}
                    {item.descriptionDiff && (
                      <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-violet-200">description</span>
                    )}
                  </div>
                  {item.priceDiff && (
                    <div className="mt-1 text-xs">
                      <span className="text-gray-500">cars.bg:</span>{' '}
                      <span className="text-gray-300">{formatPrice(item.oldPrice)}</span>
                      <span className="mx-1 text-gray-600">→</span>
                      <span className="text-white">{formatPrice(item.newPrice)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-700/60">
            <div className="border-b border-gray-700/60 bg-gray-800/70 px-4 py-3 text-sm font-medium text-gray-200">
              Stale Cars.bg Offers
            </div>
            <div className="divide-y divide-gray-700/40 bg-gray-900/40">
              {staleCarsIds.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500">No stale offers in the current plan.</div>
              ) : staleCarsIds.map((item, index) => (
                <div key={`${item.carsId || index}`} className="px-4 py-3 text-sm">
                  <div className="text-white">{item.carsId || 'Unknown cars.bg id'}</div>
                  <div className="mt-1 text-xs text-gray-500">{item.dealer}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-700/60 bg-gray-900/40">
        <div className="border-b border-gray-700/60 px-4 py-3 text-sm font-medium text-gray-200">Live log</div>
        <div ref={logRef} className="max-h-[420px] overflow-y-auto px-4 py-3 font-mono text-xs leading-6">
          {logs.length === 0 ? (
            <div className="text-gray-500">No output yet.</div>
          ) : (
            logs.map((entry, index) => (
              <div
                key={`${index}-${entry.message}`}
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
            ))
          )}
        </div>
      </div>
    </div>
  );
}
