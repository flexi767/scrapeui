'use client';

import { useEffect, useRef, useState } from 'react';
import { readJsonError, streamJsonEvents } from '@/lib/streaming-job';
import { formatPrice } from '@/lib/utils';
import { ScrapeControls } from '@/components/scrape-runner/ScrapeControls';
import { ScrapeThumbnail } from '@/components/scrape-runner/ScrapeThumbnail';
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

      {/* Detected changes */}
      {changes.length > 0 && (
        <div ref={changesRef} className="rounded-lg border border-gray-700 bg-gray-900/70 overflow-x-auto">
          <div className="border-b border-gray-700 px-4 py-3 text-sm font-medium text-gray-300">Detected changes</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/60 text-xs uppercase tracking-wider text-gray-400">
                <th className="px-4 py-2 text-left">Listing</th>
                <th className="px-4 py-2 text-left">Price</th>
                <th className="px-4 py-2 text-left">VAT</th>
                <th className="px-4 py-2 text-left">Views</th>
                <th className="px-4 py-2 text-left">Paid</th>
                <th className="px-4 py-2 text-left">Other</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {changes.map((entry, i) => (
                <tr key={i} className="hover:bg-gray-800/40 align-top">
                  <td className="px-4 py-2">
                    <div className="flex items-start gap-3">
                      <ScrapeThumbnail src={entry.thumb} href={entry.url} />
                      <div className="min-w-0 text-xs">
                        {(entry.make || entry.model) && (
                          <div className="truncate font-medium">
                            {entry.make && <span className="text-gray-500">{entry.make}</span>}
                            {entry.make && entry.model && <span className="text-white"> </span>}
                            {entry.model && <span className="text-white">{entry.model}</span>}
                          </div>
                        )}
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mb-0.5 block truncate text-[11px] text-gray-500 hover:text-blue-300"
                        >
                          {entry.title || entry.mobileId}
                        </a>
                        <div className="flex flex-wrap items-center gap-2">
                          {entry.dealer && (
                            <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[11px] text-gray-300">{entry.dealer}</span>
                          )}
                          <span className="font-semibold text-green-400">{formatPrice(entry.price ?? entry.newPrice ?? entry.oldPrice)}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {entry.priceChanged ? (
                      <span className="text-gray-300">{formatPrice(entry.oldPrice)} <span className="text-gray-500">→</span> <span className={entry.newPrice != null && entry.oldPrice != null && entry.newPrice < entry.oldPrice ? 'text-green-400' : 'text-red-400'}>{formatPrice(entry.newPrice)}</span></span>
                    ) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-300">
                    {entry.vatChanged ? `${entry.oldVat ?? '—'} → ${entry.newVat ?? '—'}` : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-300">
                    {entry.viewsChanged ? `${entry.oldViews ?? '—'} → ${entry.newViews ?? '—'}` : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-300">
                    {entry.adStatusChanged ? `${entry.oldStatus ?? '—'} → ${entry.newStatus ?? '—'}` : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-300">
                    {[entry.kaparoChanged && 'капаро', entry.titleChanged && 'title', entry.descriptionChanged && 'description'].filter(Boolean).join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Log panel */}
      {log.length > 0 && (
        <div
          ref={logRef}
          className="rounded-lg border border-gray-700 bg-gray-900 p-3 space-y-1 max-h-[600px] overflow-y-auto"
        >
          {log.map((entry, i) => {
            if (entry.type === 'listing') {
              return (
                <div key={i} className="flex items-start gap-3 py-1.5 border-b border-gray-800 last:border-0">
                  <ScrapeThumbnail src={entry.thumb} href={entry.url} />
                  <div className="flex-1 min-w-0 text-xs">
                    {(entry.make || entry.model) && (
                      <div className="truncate font-medium">
                        {entry.make && <span className="text-gray-500">{entry.make}</span>}
                        {entry.make && entry.model && <span className="text-white"> </span>}
                        {entry.model && <span className="text-white">{entry.model}</span>}
                      </div>
                    )}
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mb-0.5 block truncate text-[11px] text-gray-500 hover:text-white"
                    >
                      {entry.title}
                    </a>
                    <div className="flex items-center gap-2">
                      <span className="rounded px-1.5 py-0.5 bg-gray-700 text-gray-300 text-[11px]">{entry.dealer}</span>
                      <span className="text-green-400 font-semibold">{formatPrice(entry.price)}</span>
                      {entry.views != null && (
                        <span className="text-gray-500">
                          <span className="text-white">{entry.views.toLocaleString('en-US')}</span> views
                        </span>
                      )}
                      {entry.newListing && (
                        <span className="rounded-full bg-red-900/70 px-1.5 py-0.5 text-[10px] text-red-200">new</span>
                      )}
                      {entry.uniqueMatch && (
                        <span className="rounded-full bg-emerald-900/70 px-1.5 py-0.5 text-[10px] text-emerald-200">unique</span>
                      )}
                      {entry.syncNeeded && (
                        <span className="rounded-full bg-amber-900/70 px-1.5 py-0.5 text-[10px] text-amber-200">
                          sync{entry.mobilePrice != null ? ` ${formatPrice(entry.mobilePrice)}` : ''}
                        </span>
                      )}
                      {!!entry.imageCount && (
                        <span className="text-gray-500">
                          <span className="text-white">{entry.imageCount}</span> imgs
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            if (entry.type === 'done') {
              return (
                <div key={i} className="text-green-400 text-xs py-1 font-mono">
                  ✅ {entry.dealer}: {entry.count} listings scraped
                </div>
              );
            }

            if (entry.type === 'seeded') {
              return (
                <div key={i} className="text-blue-400 text-xs py-1 font-mono">
                  💾 {entry.message || 'Data saved'}
                </div>
              );
            }

            if (entry.type === 'error') {
              return (
                <div key={i} className="text-red-400 text-xs py-1 font-mono">
                  ❌ {entry.message}
                </div>
              );
            }

            if (entry.type === 'log') {
              return (
                <div key={i} className={`text-xs py-0.5 font-mono ${entry.level === 'stderr' ? 'text-yellow-500/80' : 'text-gray-400'}`}>
                  {entry.level === 'stderr' ? '⚠ ' : ''}{entry.message}
                </div>
              );
            }

            return null;
          })}
        </div>
      )}
    </div>
  );
}
