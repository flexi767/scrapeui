'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { streamJsonEvents } from '@/lib/streaming-job';
import { startRenewReset, stopRenewResetJob } from './api';
import { useAutoScroll } from '@/components/shared/useAutoScroll';
import { statsFromStreamEvent, streamEventMessageKind } from './helpers';
import type { LogEntry, OwnDealer, RunStats, StreamEntry } from './types';

export function useRenewReset(ownDealers: OwnDealer[]) {
  const [renewDealers, setRenewDealers] = useState<string[]>(() => ownDealers.map((d) => d.slug));
  const [renewOnlyReset, setRenewOnlyReset] = useState(false);
  const [renewRunning, setRenewRunning] = useState(false);
  const [renewStopping, setRenewStopping] = useState(false);
  const [renewStats, setRenewStats] = useState<RunStats | null>(null);
  const [renewLogs, setRenewLogs] = useState<LogEntry[]>([]);
  const [renewDone, setRenewDone] = useState<RunStats | null>(null);
  const renewAbortRef = useRef<AbortController | null>(null);
  const renewLogRef = useRef<HTMLDivElement>(null);

  useAutoScroll(renewLogRef, renewLogs);

  const appendRenewLog = (entry: LogEntry) => setRenewLogs((prev) => [...prev, entry]);

  async function runRenewReset() {
    if (renewDealers.length === 0) {
      toast.error('Select at least one dealer');
      return;
    }
    setRenewRunning(true);
    setRenewStopping(false);
    setRenewLogs([]);
    setRenewDone(null);
    setRenewStats({ total: 0, completed: 0, succeeded: 0, failed: 0 });

    const abortController = new AbortController();
    renewAbortRef.current = abortController;

    let res: Response;
    try {
      res = await startRenewReset({ dealerSlugs: renewDealers, onlyReset: renewOnlyReset, signal: abortController.signal });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setRenewRunning(false);
        setRenewStopping(false);
        renewAbortRef.current = null;
        return;
      }
      toast.error(error instanceof Error ? error.message : 'Renew & reset failed');
      setRenewRunning(false);
      setRenewStopping(false);
      renewAbortRef.current = null;
      return;
    }

    try {
      await streamJsonEvents<StreamEntry>(res, (event) => {
        if (event.type === 'start' || event.type === 'checking' || event.type === 'result' || event.type === 'complete') {
          const s = statsFromStreamEvent(event);
          setRenewStats(s);
          if (event.type === 'complete') {
            setRenewDone(s);
            setRenewRunning(false);
            setRenewStopping(false);
            renewAbortRef.current = null;
            if (s.failed === 0) toast.success(`Renewed ${s.succeeded} listing${s.succeeded === 1 ? '' : 's'}`);
            else toast.error(`Renewed ${s.succeeded}, ${s.failed} failed`);
          }
        }
        if ('message' in event && event.message) {
          const kind = streamEventMessageKind(event);
          const ok = event.type === 'result' ? event.row.status === 'success' : undefined;
          appendRenewLog({ kind, ok, message: event.message });
        }
      });
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        toast.error(error instanceof Error ? error.message : 'Renew & reset failed');
      }
    } finally {
      setRenewRunning(false);
      setRenewStopping(false);
      renewAbortRef.current = null;
    }
  }

  async function stopRenewReset() {
    if (!renewRunning || renewStopping) return;
    setRenewStopping(true);
    try {
      await stopRenewResetJob();
      appendRenewLog({ kind: 'log', message: 'Stopping…' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to stop');
      setRenewStopping(false);
      return;
    }
    renewAbortRef.current?.abort();
  }

  function toggleDealer(slug: string) {
    setRenewDealers((prev) => prev.includes(slug) ? prev.filter((d) => d !== slug) : [...prev, slug]);
  }

  function toggleAllDealers() {
    setRenewDealers(renewDealers.length === ownDealers.length ? [] : ownDealers.map((d) => d.slug));
  }

  function toggleOnlyReset() {
    setRenewOnlyReset((v) => !v);
  }

  return { renewDealers, renewOnlyReset, renewRunning, renewStopping, renewStats, renewLogs, renewDone, renewLogRef, runRenewReset, stopRenewReset, toggleDealer, toggleAllDealers, toggleOnlyReset };
}
