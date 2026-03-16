'use client';

import { useRef, useState } from 'react';

interface LogEntry {
  type: 'listing' | 'done' | 'error' | 'log' | 'seeded' | 'complete';
  dealer?: string;
  title?: string;
  price?: number | null;
  url?: string;
  thumb?: string;
  imageCount?: number;
  count?: number;
  message?: string;
  code?: number | null;
}

interface Competitor {
  id: number;
  slug: string;
  name: string;
  mobile_url: string;
  active: number;
}

function formatPrice(price: number | null | undefined) {
  if (!price) return '—';
  return `€${price.toLocaleString()}`;
}

export default function ScrapeRunner({ initialCompetitors }: { initialCompetitors: Competitor[] }) {
  const activeCompetitors = initialCompetitors.filter(c => c.active);
  const [selectedDealers, setSelectedDealers] = useState<string[]>(activeCompetitors.map(d => d.slug));
  const [deepCrawl, setDeepCrawl] = useState(true);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [done, setDone] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const toggleDealer = (slug: string) => {
    setSelectedDealers(prev =>
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    );
  };

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight;
      }
    });
  };

  const run = async () => {
    if (selectedDealers.length === 0) return;
    setRunning(true);
    setDone(false);
    setLog([]);

    let res: Response;
    try {
      res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealers: selectedDealers, deepCrawl }),
      });
    } catch (err) {
      setLog([{ type: 'error', message: String(err) }]);
      setRunning(false);
      return;
    }

    if (!res.ok || !res.body) {
      setLog([{ type: 'error', message: 'Failed to start scraper' }]);
      setRunning(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    try {
      while (true) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          try {
            const obj = JSON.parse(line.slice(6)) as LogEntry;
            setLog(prev => [...prev, obj]);
            if (obj.type === 'complete') {
              setDone(true);
              setRunning(false);
            }
            scrollToBottom();
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-6 space-y-5">
        {/* Dealers */}
        <div>
          <p className="text-sm font-medium text-gray-300 mb-3">Competitors</p>
          <div className="flex gap-5">
            {activeCompetitors.map(d => (
              <label key={d.slug} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={selectedDealers.includes(d.slug)}
                  onChange={() => toggleDealer(d.slug)}
                  disabled={running}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 disabled:opacity-50"
                />
                <span className="text-sm text-gray-200">{d.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Deep crawl toggle */}
        <div>
          <div
            onClick={() => !running && setDeepCrawl(v => !v)}
            className={`flex items-center gap-3 ${running ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
          >
            <div
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${deepCrawl ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${deepCrawl ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
            <div>
              <span className="text-sm font-medium text-gray-200">Deep crawl</span>
              <p className="text-xs text-gray-400 mt-0.5">Opens each listing detail page to extract full data</p>
            </div>
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={run}
          disabled={running || selectedDealers.length === 0}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {running && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {running ? 'Running…' : 'Run'}
        </button>
      </div>

      {/* Success banner */}
      {done && (
        <div className="rounded-lg border border-green-700/60 bg-green-900/20 px-4 py-3 text-sm text-green-400">
          ✅ Database updated
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
                  {entry.thumb ? (
                    <a href={entry.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={entry.thumb}
                        alt=""
                        className="h-[45px] w-[60px] rounded object-cover bg-gray-800 hover:opacity-80"
                        style={{aspectRatio:'4/3'}}
                      />
                    </a>
                  ) : (
                    <div className="h-[45px] w-[60px] flex-shrink-0 rounded bg-gray-800" />
                  )}
                  <div className="flex-1 min-w-0 text-xs">
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:text-white truncate block font-medium mb-0.5"
                    >
                      {entry.title}
                    </a>
                    <div className="flex items-center gap-2">
                      <span className="rounded px-1.5 py-0.5 bg-gray-700 text-gray-300 text-[11px]">{entry.dealer}</span>
                      <span className="text-green-400 font-semibold">{formatPrice(entry.price)}</span>
                      {!!entry.imageCount && (
                        <span className="text-gray-500">{entry.imageCount} imgs</span>
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
                  💾 Database seeded
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
                <div key={i} className="text-gray-400 text-xs py-0.5 font-mono">
                  {entry.message}
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
