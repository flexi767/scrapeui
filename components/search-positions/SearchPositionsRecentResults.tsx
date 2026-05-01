import { SearchPositionPreviewThumb } from '@/components/search-positions/SearchPositionPreviewThumb';
import type { SearchPositionLogEntry } from '@/components/search-positions/types';

interface SearchPositionsRecentResultsProps {
  resultRows: Array<SearchPositionLogEntry & { kind: 'result'; found: boolean }>;
}

export function SearchPositionsRecentResults({ resultRows }: SearchPositionsRecentResultsProps) {
  if (resultRows.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900/70">
      <div className="border-b border-gray-700 px-4 py-3 text-sm font-medium text-gray-300">Recent results</div>
      <div className="divide-y divide-gray-800">
        {resultRows.slice(-12).reverse().map((entry, index) => (
          <div key={`${index}-${entry.message}`} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <div className="flex min-w-0 items-center gap-3">
              <SearchPositionPreviewThumb
                thumbUrl={entry.thumbUrl ?? null}
                listingUrl={entry.listingUrl ?? null}
                label={entry.message}
              />
              <div className="min-w-0">
                <div className="truncate text-gray-200">{entry.message}</div>
                <div className="mt-1 text-xs text-gray-500">
                  {entry.found
                    ? `Orig #${entry.originalPosition ?? '—'} • Price #${entry.pricePosition ?? '—'}`
                    : 'Not found in search results'}
                </div>
              </div>
            </div>
            <div className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${entry.found ? 'bg-emerald-900/50 text-emerald-200' : 'bg-amber-900/40 text-amber-200'}`}>
              {entry.found ? 'Found' : 'Missing'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
