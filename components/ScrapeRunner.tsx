'use client';

import { useEffect, useRef, useState } from 'react';
import { readJsonError, streamJsonEvents } from '@/lib/streaming-job';
import { ScrapeChangesTable } from '@/components/scrape-runner/ScrapeChangesTable';
import { ScrapeControls } from '@/components/scrape-runner/ScrapeControls';
import { ScrapeLogPanel } from '@/components/scrape-runner/ScrapeLogPanel';
import type { ScrapeDealer, ScrapeLogEntry } from '@/components/scrape-runner/types';
import { useScrapeDealerSelection } from '@/components/scrape-runner/useScrapeDealerSelection';

export default function ScrapeRunner({ initialDealers, onRunStart }: { initialDealers: ScrapeDealer[]; onRunStart?: () => void }) {
  const dealerSelection = useScrapeDealerSelection(initialDealers);

  const [deepCrawl, setDeepCrawl] = useState(false);
  const [downloadImages, setDownloadImages] = useState(false);
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [log, setLog] = useState<ScrapeLogEntry[]>([]);
  const [done, setDone] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const changesRef = useRef<HTMLDivElement>(null);
  const runAbortRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight;
      }
    });
  };

  useEffect(() => {
    if (!deepCrawl) setDownloadImages(false);
  }, [deepCrawl]);

  const changes = log.filter((e) => e.type === 'change');

  useEffect(() => {
    if (changes.length > 0) {
      changesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [changes.length]);

  const run = async () => {
    if (dealerSelection.effectiveSelected.length === 0) return;
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
        body: JSON.stringify({ dealers: dealerSelection.effectiveSelected, deepCrawl, downloadImages, source: dealerSelection.source }),
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
        source={dealerSelection.source}
        running={running}
        stopping={stopping}
        deepCrawl={deepCrawl}
        activeDealers={dealerSelection.activeDealers}
        availableDealers={dealerSelection.availableDealers}
        effectiveSelected={dealerSelection.effectiveSelected}
        allActiveSelected={dealerSelection.allActiveSelected}
        onSourceChange={(nextSource) => {
          if (!running) dealerSelection.selectSource(nextSource);
        }}
        onToggleDealer={dealerSelection.toggleDealer}
        onToggleSelectAllDealers={dealerSelection.toggleSelectAllDealers}
        onToggleDeepCrawl={() => !running && setDeepCrawl((value) => !value)}
        downloadImages={downloadImages}
        onToggleDownloadImages={() => !running && deepCrawl && setDownloadImages((v) => !v)}
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
