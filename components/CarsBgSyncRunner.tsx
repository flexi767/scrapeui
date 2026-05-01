'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { DealerRow } from '@/lib/queries';
import { readJsonError, streamJsonEvents } from '@/lib/streaming-job';
import { CarsBgSyncDealerSelector } from '@/components/cars-bg-sync/CarsBgSyncDealerSelector';
import { CarsBgSyncDoneBanner } from '@/components/cars-bg-sync/CarsBgSyncDoneBanner';
import { CarsBgSyncLogPanel } from '@/components/cars-bg-sync/CarsBgSyncLogPanel';
import { CarsBgSyncOverview } from '@/components/cars-bg-sync/CarsBgSyncOverview';
import { CarsBgSyncPlanGrid } from '@/components/cars-bg-sync/CarsBgSyncPlanGrid';
import { CarsBgSyncRunControls } from '@/components/cars-bg-sync/CarsBgSyncRunControls';
import { ZERO_CARS_BG_SYNC_TOTALS } from '@/components/cars-bg-sync/helpers';
import type { CarsBgSyncLogEntry, CarsBgSyncStreamEntry, CarsBgSyncTotals, DiffItem, MissingItem, StaleCarsItem } from '@/components/cars-bg-sync/types';

interface Props {
  dealers: DealerRow[];
}

export default function CarsBgSyncRunner({ dealers }: Props) {
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const [currentDealer, setCurrentDealer] = useState<string | null>(null);
  const [selectedDealers, setSelectedDealers] = useState<string[]>(() => dealers.map((dealer) => dealer.slug));
  const [totals, setTotals] = useState<CarsBgSyncTotals>(ZERO_CARS_BG_SYNC_TOTALS);
  const [doneSummary, setDoneSummary] = useState<CarsBgSyncTotals | null>(null);
  const [missing, setMissing] = useState<MissingItem[]>([]);
  const [diffs, setDiffs] = useState<DiffItem[]>([]);
  const [openDescriptionKey, setOpenDescriptionKey] = useState<string | null>(null);
  const [staleCarsIds, setStaleCarsIds] = useState<StaleCarsItem[]>([]);
  const [logs, setLogs] = useState<CarsBgSyncLogEntry[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const hasPlan = missing.length > 0 || diffs.length > 0 || staleCarsIds.length > 0 || doneSummary !== null;

  const allSelected = selectedDealers.length === dealers.length;
  const appendLog = (entry: CarsBgSyncLogEntry) => setLogs((prev) => [...prev, entry]);

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
    setTotals(ZERO_CARS_BG_SYNC_TOTALS);
    setDoneSummary(null);
    setMissing([]);
    setDiffs([]);
    setOpenDescriptionKey(null);
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
      const message = await readJsonError(res, 'Failed to start cars.bg sync');
      setLogs([{ kind: 'error', message }]);
      toast.error(message);
      setRunning(false);
      setStopping(false);
      abortRef.current = null;
      return;
    }

    try {
      await streamJsonEvents<CarsBgSyncStreamEntry>(res, (event) => {
            if (event.type === 'start') {
              if (event.message) appendLog({ kind: 'status', message: event.message });
              return;
            }

            if (event.type === 'dealer') {
              setCurrentDealer(event.dealer);
              if (event.message) appendLog({ kind: 'status', message: event.message });
              return;
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
              return;
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
              return;
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
                oldTitle: event.oldTitle ?? null,
                newTitle: event.newTitle ?? null,
                oldDescription: event.oldDescription ?? null,
                newDescription: event.newDescription ?? null,
                url: event.url,
              }]);
              return;
            }

            if (event.type === 'stale') {
              setStaleCarsIds((prev) => [...prev, { dealer: event.dealer, carsId: event.carsId }]);
              return;
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
              return;
            }

            if (event.type === 'log') {
              if (event.message) {
                appendLog({
                  kind: event.level === 'stderr' ? 'error' : 'log',
                  message: event.dealer ? `${event.dealer}: ${event.message}` : event.message,
                });
              }
              return;
            }

            if (event.type === 'error') {
              const message = event.message || 'Cars.bg sync failed';
              appendLog({ kind: 'error', message });
              toast.error(message);
              return;
            }

            if (event.type === 'end') {
              const summary: CarsBgSyncTotals = {
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
              return;
            }
      });
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
        <CarsBgSyncOverview totals={totals} running={running} liveMode={liveMode} doneSummary={doneSummary} />

        <CarsBgSyncRunControls
          running={running}
          stopping={stopping}
          currentDealer={currentDealer}
          onPreview={running ? stop : () => void run(false)}
          onRunLive={() => void run(true)}
        />

        <CarsBgSyncDealerSelector
          dealers={dealers}
          selectedDealers={selectedDealers}
          running={running}
          allSelected={allSelected}
          onToggleDealer={toggleDealer}
          onToggleAll={() => setSelectedDealers(allSelected ? [] : dealers.map((dealer) => dealer.slug))}
        />
      </div>

      <CarsBgSyncDoneBanner doneSummary={doneSummary} liveMode={liveMode} />

      {hasPlan && (
        <CarsBgSyncPlanGrid
          missing={missing}
          diffs={diffs}
          staleCarsIds={staleCarsIds}
          openDescriptionKey={openDescriptionKey}
          onToggleDescription={(key) => setOpenDescriptionKey((prev) => prev === key ? null : key)}
        />
      )}

      <CarsBgSyncLogPanel logs={logs} logRef={logRef} />
    </div>
  );
}
