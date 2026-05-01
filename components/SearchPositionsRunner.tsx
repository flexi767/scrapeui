'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { readJsonError, streamJsonEvents } from '@/lib/streaming-job';
import { labelForRow, labelForTarget, logEntryFromResult, summaryFromCompleteEvent } from '@/components/search-positions/helpers';
import { SearchPositionsDoneBanner } from '@/components/search-positions/SearchPositionsDoneBanner';
import { SearchPositionsLogPanel } from '@/components/search-positions/SearchPositionsLogPanel';
import { SearchPositionsRecentResults } from '@/components/search-positions/SearchPositionsRecentResults';
import { SearchPositionsControlPanel } from '@/components/search-positions/SearchPositionsControlPanel';
import type { RankStats, SearchPositionLogEntry, SearchPositionPreview, SearchPositionStreamEntry, SearchPositionSummary } from '@/components/search-positions/types';

export default function SearchPositionsRunner() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [activeMode, setActiveMode] = useState<'all' | 'missing' | null>(null);
  const [logs, setLogs] = useState<SearchPositionLogEntry[]>([]);
  const [stats, setStats] = useState<RankStats | null>(null);
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);
  const [currentPreview, setCurrentPreview] = useState<SearchPositionPreview | null>(null);
  const [doneSummary, setDoneSummary] = useState<SearchPositionSummary | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const resultRows = useMemo(
    () => logs.filter((entry): entry is SearchPositionLogEntry & { kind: 'result'; found: boolean } => entry.kind === 'result' && typeof entry.found === 'boolean'),
    [logs],
  );
  const appendLog = (entry: SearchPositionLogEntry) => setLogs((prev) => [...prev, entry]);

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
      const message = await readJsonError(res, 'Failed to start search-position run');
      toast.error(message);
      setLogs([{ kind: 'error', message }]);
      setRunning(false);
      setStopping(false);
      setActiveMode(null);
      abortRef.current = null;
      return;
    }

    try {
      await streamJsonEvents<SearchPositionStreamEntry>(res, (event) => {
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
              setCurrentLabel(null);
              setCurrentPreview(null);
              setRunning(false);
              setStopping(false);
              setActiveMode(null);
              abortRef.current = null;
              toast.success(`Checked ${event.total} listings • found ${event.found} • missing ${event.notFound}`);
              router.refresh();
              return;
            }
      });
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
      <SearchPositionsControlPanel
        running={running}
        stopping={stopping}
        activeMode={activeMode}
        stats={stats}
        doneSummary={doneSummary}
        currentLabel={currentLabel}
        currentPreview={currentPreview}
        onCheckAll={running ? stop : () => void run(false)}
        onMissingOnly={() => void run(true)}
      />

      <SearchPositionsDoneBanner doneSummary={doneSummary} />

      <SearchPositionsRecentResults resultRows={resultRows} />

      <SearchPositionsLogPanel logs={logs} logRef={logRef} />
    </div>
  );
}
