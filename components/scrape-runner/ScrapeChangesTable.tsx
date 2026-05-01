import type { Ref } from 'react';
import { formatPrice } from '@/lib/utils';
import { ScrapeThumbnail } from '@/components/scrape-runner/ScrapeThumbnail';
import type { ScrapeLogEntry } from '@/components/scrape-runner/types';

interface ScrapeChangesTableProps {
  changes: ScrapeLogEntry[];
  changesRef: Ref<HTMLDivElement>;
}

export function ScrapeChangesTable({ changes, changesRef }: ScrapeChangesTableProps) {
  if (changes.length === 0) return null;

  return (
    <div ref={changesRef} className="overflow-x-auto rounded-lg border border-gray-700 bg-gray-900/70">
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
            <tr key={i} className="align-top hover:bg-gray-800/40">
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
                  <span className="text-gray-300">
                    {formatPrice(entry.oldPrice)} <span className="text-gray-500">→</span>{' '}
                    <span className={entry.newPrice != null && entry.oldPrice != null && entry.newPrice < entry.oldPrice ? 'text-green-400' : 'text-red-400'}>
                      {formatPrice(entry.newPrice)}
                    </span>
                  </span>
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
  );
}
