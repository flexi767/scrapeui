'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import type { DealerRow } from '@/lib/queries';
import { readJsonError, streamJsonEvents } from '@/lib/streaming-job';
import { errorMessage } from '@/lib/utils';
import { CarsBgSyncDealerSelector } from '@/components/cars-bg-sync/CarsBgSyncDealerSelector';
import { CarsBgSyncDoneBanner } from '@/components/cars-bg-sync/CarsBgSyncDoneBanner';
import { CarsBgSyncLogPanel } from '@/components/cars-bg-sync/CarsBgSyncLogPanel';
import { CarsBgSyncOverview } from '@/components/cars-bg-sync/CarsBgSyncOverview';
import { CarsBgSyncPlanGrid } from '@/components/cars-bg-sync/CarsBgSyncPlanGrid';
import { CarsBgSyncRunControls } from '@/components/cars-bg-sync/CarsBgSyncRunControls';
import {
  addDoneTotals,
  addSummaryTotals,
  diffItemFromEvent,
  doneLogFromEvent,
  missingItemFromEvent,
  staleItemFromEvent,
  streamLogFromEvent,
  summaryLogFromEvent,
  totalsFromEndEvent,
  ZERO_CARS_BG_SYNC_TOTALS,
} from '@/components/cars-bg-sync/helpers';
import type { CarsBgSyncLogEntry, CarsBgSyncStreamEntry, CarsBgSyncTotals, DiffItem, MissingItem, StaleCarsItem } from '@/components/cars-bg-sync/types';
import { useAutoScroll } from '@/components/shared/useAutoScroll';

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

  useAutoScroll(logRef, logs);

  const hasPlan = missing.length > 0 || diffs.length > 0 || staleCarsIds.length > 0 || doneSummary !== null;

  const allSelected = selectedDealers.length === dealers.length;
  const appendLog = (entry: CarsBgSyncLogEntry) => setLogs((prev) => [...prev, entry]);

  function toggleDealer(slug: string) {
    setSelectedDealers((prev) => prev.includes(slug) ? prev.filter((entry) => entry !== slug) : [...prev, slug]);
  }

  function resetRunState(live: boolean) {
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
  }

  function finishRun() {
    setRunning(false);
    setStopping(false);
    setCurrentDealer(null);
    abortRef.current = null;
  }

  async function run(live: boolean) {
    if (selectedDealers.length === 0) {
      toast.error('Select at least one dealer');
      return;
    }
    resetRunState(live);

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
        finishRun();
        return;
      }
      const message = errorMessage(error);
      setLogs([{ kind: 'error', message }]);
      toast.error(message);
      finishRun();
      return;
    }

    if (!res.ok || !res.body) {
      const message = await readJsonError(res, 'Failed to start cars.bg sync');
      setLogs([{ kind: 'error', message }]);
      toast.error(message);
      finishRun();
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
              setTotals((prev) => addSummaryTotals(prev, event));
              appendLog(summaryLogFromEvent(event));
              return;
            }

            if (event.type === 'listing') {
              setMissing((prev) => [...prev, missingItemFromEvent(event)]);
              return;
            }

            if (event.type === 'diff') {
              setDiffs((prev) => [...prev, diffItemFromEvent(event)]);
              return;
            }

            if (event.type === 'stale') {
              setStaleCarsIds((prev) => [...prev, staleItemFromEvent(event)]);
              return;
            }

            if (event.type === 'done') {
              setTotals((prev) => addDoneTotals(prev, event));
              appendLog(doneLogFromEvent(event));
              return;
            }

            if (event.type === 'log') {
              const logEntry = streamLogFromEvent(event);
              if (logEntry) appendLog(logEntry);
              return;
            }

            if (event.type === 'error') {
              const message = event.message || 'Cars.bg sync failed';
              appendLog({ kind: 'error', message });
              toast.error(message);
              return;
            }

            if (event.type === 'end') {
              const summary = totalsFromEndEvent(event);
              setDoneSummary(summary);
              setTotals(summary);
              finishRun();
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
        const message = errorMessage(error);
        appendLog({ kind: 'error', message });
        toast.error(message);
      }
    } finally {
      finishRun();
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
      const message = errorMessage(error);
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
