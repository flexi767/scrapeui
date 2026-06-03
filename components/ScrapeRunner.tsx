'use client';

import { useEffect, useRef, useState } from 'react';
import { ScrapeChangesTable } from '@/components/scrape-runner/ScrapeChangesTable';
import { ScrapeControls } from '@/components/scrape-runner/ScrapeControls';
import { ScrapeLogPanel } from '@/components/scrape-runner/ScrapeLogPanel';
import type { ScrapeDealer, ScrapeLogEntry } from '@/components/scrape-runner/types';
import { useScrapeDealerSelection } from '@/components/scrape-runner/useScrapeDealerSelection';
import { useAutoScroll } from '@/components/shared/useAutoScroll';
import { useStreamingRun } from '@/components/shared/useStreamingRun';

export default function ScrapeRunner({ initialDealers, onRunStart }: { initialDealers: ScrapeDealer[]; onRunStart?: () => void }) {
  const dealerSelection = useScrapeDealerSelection(initialDealers);

  const [deepCrawl, setDeepCrawl] = useState(false);
  const [downloadImages, setDownloadImages] = useState(false);
  const [log, setLog] = useState<ScrapeLogEntry[]>([]);
  const [done, setDone] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const changesRef = useRef<HTMLDivElement>(null);
  const effectiveDownloadImages = deepCrawl && downloadImages;

  useAutoScroll(logRef, log);

  const changes = log.filter((e) => e.type === 'change');

  useEffect(() => {
    if (changes.length > 0) {
      changesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [changes.length]);

  const streamRun = useStreamingRun<ScrapeLogEntry>({
    fallbackStartError: 'Failed to start scraper',
    start: (signal) => fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealers: dealerSelection.effectiveSelected, deepCrawl, downloadImages: effectiveDownloadImages, source: dealerSelection.source }),
      signal,
    }),
    stop: async () => {
      await fetch('/api/scrape', { method: 'DELETE' });
    },
    onEvent: (obj) => {
      setLog(prev => [...prev, obj]);
      if (obj.type === 'complete') setDone(true);
    },
    onStartError: (message) => setLog([{ type: 'error', message }]),
    onStreamError: (message) => setLog((prev) => [...prev, { type: 'error', message }]),
    onStopError: (message) => setLog((prev) => [...prev, { type: 'error', message: `Failed to stop scraper: ${message}` }]),
  });

  const run = async () => {
    if (dealerSelection.effectiveSelected.length === 0) return;
    onRunStart?.();
    setDone(false);
    setLog([]);
    await streamRun.run();
  };

  function toggleDeepCrawl() {
    if (streamRun.running) return;
    if (deepCrawl) setDownloadImages(false);
    setDeepCrawl((value) => !value);
  }

  return (
    <div className="space-y-6">
      <ScrapeControls
        source={dealerSelection.source}
        running={streamRun.running}
        stopping={streamRun.stopping}
        deepCrawl={deepCrawl}
        activeDealers={dealerSelection.activeDealers}
        availableDealers={dealerSelection.availableDealers}
        effectiveSelected={dealerSelection.effectiveSelected}
        allActiveSelected={dealerSelection.allActiveSelected}
        onSourceChange={(nextSource) => {
          if (!streamRun.running) dealerSelection.selectSource(nextSource);
        }}
        onToggleDealer={dealerSelection.toggleDealer}
        onToggleSelectAllDealers={dealerSelection.toggleSelectAllDealers}
        onToggleDeepCrawl={toggleDeepCrawl}
        downloadImages={effectiveDownloadImages}
        onToggleDownloadImages={() => !streamRun.running && deepCrawl && setDownloadImages((v) => !v)}
        onRunClick={streamRun.running ? streamRun.stop : run}
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
