import type { Ref } from 'react';
import { formatCount, formatPrice } from '@/lib/utils';
import { ScrapeThumbnail } from '@/components/scrape-runner/ScrapeThumbnail';
import type { ScrapeLogEntry } from '@/components/scrape-runner/types';

interface ScrapeLogPanelProps {
  log: ScrapeLogEntry[];
  logRef: Ref<HTMLDivElement>;
}

export function ScrapeLogPanel({ log, logRef }: ScrapeLogPanelProps) {
  if (log.length === 0) return null;

  return (
    <div
      ref={logRef}
      className="max-h-[600px] space-y-1 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 p-3"
    >
      {log.map((entry, i) => {
        if (entry.type === 'listing') {
          return (
            <div key={i} className="flex items-start gap-3 border-b border-gray-800 py-1.5 last:border-0">
              <ScrapeThumbnail src={entry.thumb} href={entry.url} />
              <div className="min-w-0 flex-1 text-xs">
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
                  <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[11px] text-gray-300">{entry.dealer}</span>
                  <span className="font-semibold text-green-400">{formatPrice(entry.price)}</span>
                  {entry.views != null && (
                    <span className="text-gray-500">
                      <span className="text-white">{formatCount(entry.views)}</span> views
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
            <div key={i} className="py-1 font-mono text-xs text-green-400">
              ✅ {entry.dealer}: {entry.count} listings scraped
            </div>
          );
        }

        if (entry.type === 'seeded') {
          return (
            <div key={i} className="py-1 font-mono text-xs text-blue-400">
              💾 {entry.message || 'Data saved'}
            </div>
          );
        }

        if (entry.type === 'error') {
          return (
            <div key={i} className="py-1 font-mono text-xs text-red-400">
              ❌ {entry.message}
            </div>
          );
        }

        if (entry.type === 'log') {
          return (
            <div key={i} className={`py-0.5 font-mono text-xs ${entry.level === 'stderr' ? 'text-yellow-500/80' : 'text-gray-400'}`}>
              {entry.level === 'stderr' ? '⚠ ' : ''}{entry.message}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
