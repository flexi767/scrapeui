'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { readJsonError } from '@/lib/streaming-job';
import { labelForRow, labelForTarget, logEntryFromResult, summaryFromCompleteEvent } from '@/components/search-positions/helpers';
import { SearchPositionsDoneBanner } from '@/components/search-positions/SearchPositionsDoneBanner';
import { SearchPositionsLogPanel } from '@/components/search-positions/SearchPositionsLogPanel';
import { SearchPositionsRecentResults } from '@/components/search-positions/SearchPositionsRecentResults';
import { SearchPositionsControlPanel } from '@/components/search-positions/SearchPositionsControlPanel';
import type { RankStats, SearchPositionLogEntry, SearchPositionPreview, SearchPositionStreamEntry, SearchPositionSummary } from '@/components/search-positions/types';
import { useAutoScroll } from '@/components/shared/useAutoScroll';
import { useStreamingRun } from '@/components/shared/useStreamingRun';

export default function SearchPositionsRunner() {
  const router = useRouter();
  const [activeMode, setActiveMode] = useState<'all' | 'missing' | null>(null);
  const [logs, setLogs] = useState<SearchPositionLogEntry[]>([]);
  const [stats, setStats] = useState<RankStats | null>(null);
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);
  const [currentPreview, setCurrentPreview] = useState<SearchPositionPreview | null>(null);
  const [doneSummary, setDoneSummary] = useState<SearchPositionSummary | null>(null);
  const missingOnlyRef = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);

  useAutoScroll(logRef, logs);

  const resultRows = useMemo(
    () => logs.filter((entry): entry is SearchPositionLogEntry & { kind: 'result'; found: boolean } => entry.kind === 'result' && typeof entry.found === 'boolean'),
    [logs],
  );
  const appendLog = (entry: SearchPositionLogEntry) => setLogs((prev) => [...prev, entry]);

  function resetRunState(missingOnly: boolean) {
    missingOnlyRef.current = missingOnly;
    setActiveMode(missingOnly ? 'missing' : 'all');
    setLogs([]);
    setStats(null);
    setCurrentLabel(null);
    setCurrentPreview(null);
    setDoneSummary(null);
  }

  const streamRun = useStreamingRun<SearchPositionStreamEntry>({
    fallbackStartError: 'Failed to start search-position run',
    start: (signal) => fetch('/api/editown/search-ranks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missingOnly: missingOnlyRef.current }),
      signal,
    }),
    stop: async () => {
      const res = await fetch('/api/editown/search-ranks', { method: 'DELETE' });
      if (!res.ok) throw new Error(await readJsonError(res, 'Failed to stop search-position run'));
    },
    onEvent: (event) => {
      if (event.type === 'start') {
        setStats(event.stats);
        if (event.message) appendLog({ kind: 'status', message: event.message });
        return;
      }

      if (event.type === 'checking') {
        setStats(event.stats);
        setCurrentLabel(labelForTarget(event.target));
        setCurrentPreview({ thumbUrl: event.target.thumb_url, listingUrl: event.target.listing_url });
        if (event.message) appendLog({ kind: 'status', message: event.message });
        return;
      }

      if (event.type === 'result') {
        setStats(event.stats);
        setCurrentLabel(labelForRow(event.row));
        setCurrentPreview({ thumbUrl: event.row.thumb_url, listingUrl: event.row.listing_url });
        appendLog(logEntryFromResult(event.row));
        return;
      }

      if (event.type === 'log') {
        if (event.message) {
          appendLog({ kind: 'log', message: event.message });
        }
        return;
      }

      if (event.type === 'error') {
        const message = event.message || 'Search-position run failed';
        appendLog({ kind: 'error', message });
        toast.error(message);
        return;
      }

      if (event.type === 'complete') {
        setDoneSummary(summaryFromCompleteEvent(event));
        toast.success(`Checked ${event.total} listings • found ${event.found} • missing ${event.notFound}`);
        router.refresh();
      }
    },
    onFinish: () => {
      setActiveMode(null);
      setCurrentLabel(null);
      setCurrentPreview(null);
    },
    onStartError: (message) => {
      toast.error(message);
      setLogs([{ kind: 'error', message }]);
    },
    onStreamError: (message) => {
      appendLog({ kind: 'error', message });
      toast.error(message);
    },
    onStopError: (message) => {
      appendLog({ kind: 'error', message });
      toast.error(message);
    },
    onStopRequested: () => appendLog({ kind: 'log', message: 'Stopping search-position run…' }),
  });

  async function run(missingOnly = false) {
    resetRunState(missingOnly);
    await streamRun.run();
  }

  return (
    <div className="space-y-6">
      <SearchPositionsControlPanel
        running={streamRun.running}
        stopping={streamRun.stopping}
        activeMode={activeMode}
        stats={stats}
        doneSummary={doneSummary}
        currentLabel={currentLabel}
        currentPreview={currentPreview}
        onCheckAll={streamRun.running ? streamRun.stop : () => void run(false)}
        onMissingOnly={() => void run(true)}
      />

      <SearchPositionsDoneBanner doneSummary={doneSummary} />

      <SearchPositionsRecentResults resultRows={resultRows} />

      <SearchPositionsLogPanel logs={logs} logRef={logRef} />
    </div>
  );
}
