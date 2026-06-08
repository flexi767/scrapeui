'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { DealerRow } from '@/lib/queries';
import { startJsonStream, stopJsonStream } from '@/lib/streaming-job';
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
import { useStreamingRun } from '@/components/shared/useStreamingRun';

interface Props {
  dealers: DealerRow[];
}

export default function CarsBgSyncRunner({ dealers }: Props) {
  const t = useTranslations('ui');
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
  const liveRunRef = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);

  useAutoScroll(logRef, logs);

  const hasPlan = missing.length > 0 || diffs.length > 0 || staleCarsIds.length > 0 || doneSummary !== null;

  const allSelected = selectedDealers.length === dealers.length;
  const appendLog = (entry: CarsBgSyncLogEntry) => setLogs((prev) => [...prev, entry]);

  function toggleDealer(slug: string) {
    setSelectedDealers((prev) => prev.includes(slug) ? prev.filter((entry) => entry !== slug) : [...prev, slug]);
  }

  function resetRunState(live: boolean) {
    liveRunRef.current = live;
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

  const streamRun = useStreamingRun<CarsBgSyncStreamEntry>({
    fallbackStartError: t('failed_to_start_carsbg_sync'),
    start: (signal) => startJsonStream('/api/editown/carsbg-sync', { json: { live: liveRunRef.current, dealers: selectedDealers }, signal }),
    stop: () => stopJsonStream('/api/editown/carsbg-sync', t('failed_to_stop_carsbg_sync')),
    onEvent: (event) => {
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
        const message = event.message || t('carsbg_sync_failed');
        appendLog({ kind: 'error', message });
        toast.error(message);
        return;
      }

      if (event.type === 'end') {
        const summary = totalsFromEndEvent(event);
        setDoneSummary(summary);
        setTotals(summary);
        if (event.message) appendLog({ kind: 'status', message: event.message });
        if (liveRunRef.current) {
          if (event.failedUpdates + event.failedCreates + event.failedDeletes === 0) {
            toast.success(`Cars.bg sync finished: ${event.updated} updated, ${event.created} created, ${event.deleted} deleted`);
          } else {
            toast.error(t('carsbg_sync_finished_with_failures'));
          }
        } else {
          toast.success(`Cars.bg plan ready: ${event.missing} missing, ${event.diffs} diffs, ${event.stale} stale`);
        }
      }
    },
    onFinish: () => setCurrentDealer(null),
    onStartError: (message) => {
      setLogs([{ kind: 'error', message }]);
      toast.error(message);
    },
    onStreamError: (message) => {
      appendLog({ kind: 'error', message });
      toast.error(message);
    },
    onStopError: (message) => {
      appendLog({ kind: 'error', message });
      toast.error(message);
    },
    onStopRequested: () => appendLog({ kind: 'log', message: t('stopping_carsbg_sync') }),
  });

  async function run(live: boolean) {
    if (selectedDealers.length === 0) {
      toast.error(t('select_at_least_one_dealer'));
      return;
    }
    resetRunState(live);
    await streamRun.run();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-6 space-y-5">
        <CarsBgSyncOverview totals={totals} running={streamRun.running} liveMode={liveMode} doneSummary={doneSummary} />

        <CarsBgSyncRunControls
          running={streamRun.running}
          stopping={streamRun.stopping}
          currentDealer={currentDealer}
          onPreview={streamRun.running ? streamRun.stop : () => void run(false)}
          onRunLive={() => void run(true)}
        />

        <CarsBgSyncDealerSelector
          dealers={dealers}
          selectedDealers={selectedDealers}
          running={streamRun.running}
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
