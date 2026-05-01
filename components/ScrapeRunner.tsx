'use client';

import { useEffect, useRef, useState } from 'react';
import { readJsonError, streamJsonEvents } from '@/lib/streaming-job';
import { ScrapeChangesTable } from '@/components/scrape-runner/ScrapeChangesTable';
import { ScrapeControls } from '@/components/scrape-runner/ScrapeControls';
import { ScrapeLogPanel } from '@/components/scrape-runner/ScrapeLogPanel';
import type { ScrapeDealer, ScrapeLogEntry, ScrapeSource } from '@/components/scrape-runner/types';

export default function ScrapeRunner({ initialDealers, onRunStart }: { initialDealers: ScrapeDealer[]; onRunStart?: () => void }) {
  const [source, setSource] = useState<ScrapeSource>('mobile');
  const activeDealers = initialDealers.filter((dealer) => dealer.active);
  const availableDealers = activeDealers.filter((dealer) => source === 'mobile' ? dealer.mobile_url : dealer.cars_url);
  const [selectedDealers, setSelectedDealers] = useState<string[]>(initialDealers.filter(d => d.active && d.own && d.mobile_url).map(d => d.slug));

  // Effective selection: only keep slugs that are still active
  const activeSlugs = new Set(availableDealers.map(d => d.slug));
  const effectiveSelected = selectedDealers.filter(slug => activeSlugs.has(slug));
  const allActiveSelected = availableDealers.length > 0 && effectiveSelected.length === availableDealers.length;

  useEffect(() => {
    const nextActiveSlugs = new Set(activeDealers.map(d => d.slug));
    setSelectedDealers(prev => {
      const next = prev.filter(slug => nextActiveSlugs.has(slug));
      return next.length === prev.length ? prev : next;
    });
  }, [activeDealers]);

  const [deepCrawl, setDeepCrawl] = useState(false);
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [log, setLog] = useState<ScrapeLogEntry[]>([]);
  const [done, setDone] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const changesRef = useRef<HTMLDivElement>(null);
  const runAbortRef = useRef<AbortController | null>(null);

  const toggleDealer = (slug: string) => {
    setSelectedDealers(prev =>
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    );
  };

  const toggleSelectAllDealers = () => {
    setSelectedDealers((prev) => {
      const inactiveSelections = prev.filter((slug) => !activeSlugs.has(slug));
      if (allActiveSelected) return inactiveSelections;
      return [...inactiveSelections, ...availableDealers.map((dealer) => dealer.slug)];
    });
  };

  const selectSource = (nextSource: ScrapeSource) => {
    if (running) return;
    setSource(nextSource);
    setSelectedDealers(
      initialDealers
        .filter((dealer) => dealer.active && dealer.own && (nextSource === 'mobile' ? dealer.mobile_url : dealer.cars_url))
        .map((dealer) => dealer.slug),
    );
  };

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight;
      }
    });
  };

  const changes = log.filter((e) => e.type === 'change');

  useEffect(() => {
    if (changes.length > 0) {
      changesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [changes.length]);

  const run = async () => {
    if (effectiveSelected.length === 0) return;
    onRunStart?.();
    setRunning(true);
    setStopping(false);
    setDone(false);
    setLog([]);

    const abortController = new AbortController();
    runAbortRef.current = abortController;

    let res: Response;
    try {
      res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealers: effectiveSelected, deepCrawl, source }),
        signal: abortController.signal,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setRunning(false);
        setStopping(false);
        runAbortRef.current = null;
        return;
      }
      setLog([{ type: 'error', message: String(err) }]);
      setRunning(false);
      setStopping(false);
      runAbortRef.current = null;
      return;
    }

    if (!res.ok || !res.body) {
      const message = await readJsonError(res, 'Failed to start scraper');
      setLog([{ type: 'error', message }]);
      setRunning(false);
      setStopping(false);
      runAbortRef.current = null;
      return;
    }

    try {
      await streamJsonEvents<ScrapeLogEntry>(res, (obj) => {
        setLog(prev => [...prev, obj]);
        if (obj.type === 'complete') {
          setDone(true);
          setRunning(false);
          setStopping(false);
          runAbortRef.current = null;
        }
        scrollToBottom();
      });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setLog((prev) => [...prev, { type: 'error', message: String(err) }]);
      }
    } finally {
      setRunning(false);
      setStopping(false);
      runAbortRef.current = null;
    }
  };

  const stop = async () => {
    if (!running || stopping) return;
    setStopping(true);
    try {
      await fetch('/api/scrape', { method: 'DELETE' });
    } catch (err) {
      setLog((prev) => [...prev, { type: 'error', message: `Failed to stop scraper: ${String(err)}` }]);
      setStopping(false);
      return;
    }

    runAbortRef.current?.abort();
  };

  return (
    <div className="space-y-6">
      <ScrapeControls
        source={source}
        running={running}
        stopping={stopping}
        deepCrawl={deepCrawl}
        activeDealers={activeDealers}
        availableDealers={availableDealers}
        effectiveSelected={effectiveSelected}
        allActiveSelected={allActiveSelected}
        onSourceChange={selectSource}
        onToggleDealer={toggleDealer}
        onToggleSelectAllDealers={toggleSelectAllDealers}
        onToggleDeepCrawl={() => !running && setDeepCrawl((value) => !value)}
        onRunClick={running ? stop : run}
      />

      {/* Success banner */}
      {done && (
        <div className="rounded-lg border border-green-700/60 bg-green-900/20 px-4 py-3 text-sm text-green-400">
          ✅ Database updated
        </div>
      )}

      <ScrapeChangesTable changes={changes} changesRef={changesRef} />

      <ScrapeLogPanel log={log} logRef={logRef} />
    </div>
  );
}
