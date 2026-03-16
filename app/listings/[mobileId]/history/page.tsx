import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getListingByMobileId, getSnapshots } from '@/lib/queries';
import { formatDate, formatPrice } from '@/lib/utils';

interface Props {
  params: Promise<{ mobileId: string }>;
}

function formatDateAxis(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  return `${dd}.${mm}.${yy}`;
}

export default async function PriceHistoryPage({ params }: Props) {
  const { mobileId } = await params;
  const listing = getListingByMobileId(mobileId);
  if (!listing) notFound();

  const snapshots = getSnapshots(listing.id);

  // Build price series for the chart: old prices from snapshots + current price as final point
  const pricePoints = [
    ...snapshots
      .filter(s => s.price != null)
      .map(s => ({ price: s.price, recorded_at: s.recorded_at })),
    { price: listing.current_price, recorded_at: new Date().toISOString() },
  ];

  return (
    <div className="min-h-screen bg-[#111827]">
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3">
          <Link href={`/listings/${mobileId}`} className="text-sm text-gray-400 hover:text-white">
            ← {listing.title}
          </Link>
          <span className="text-gray-600">/</span>
          <span className="text-sm text-gray-300">History</span>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">{listing.title}</h1>
          <p className="mt-1 text-sm text-gray-400">
            {snapshots.length} historical snapshot{snapshots.length !== 1 ? 's' : ''}
          </p>
        </div>

        {snapshots.length === 0 ? (
          <div className="rounded-lg border border-gray-700/60 p-12 text-center text-gray-500">
            No history recorded yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-700/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-800/60 text-xs font-medium uppercase tracking-wider text-gray-400">
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-center">VAT</th>
                  <th className="px-4 py-3 text-center">Last Edit</th>
                  <th className="px-4 py-3 text-center">Paid</th>
                  <th className="px-4 py-3 text-center">К</th>
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-right">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {snapshots.map((snap, i) => {
                  const prev = snapshots[i - 1];
                  const delta = prev ? snap.price - prev.price : null;
                  const deltaAbs = delta !== null ? Math.abs(delta) : null;

                  return (
                    <tr
                      key={snap.id}
                      className="group transition-colors hover:bg-gray-800/40"
                    >
                      <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                      <td className="px-4 py-3 text-gray-300">
                        {formatDate(snap.recorded_at)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-400">
                        {formatPrice(snap.price)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {snap.vat === 'included' ? (
                          <span className="rounded-full bg-blue-900/70 px-2 py-0.5 text-[11px] text-blue-200">има</span>
                        ) : snap.vat === 'exempt' ? (
                          <span className="rounded-full bg-green-900/70 px-2 py-0.5 text-[11px] text-green-200">няма</span>
                        ) : snap.vat === 'excluded' ? (
                          <span className="rounded-full bg-red-900/70 px-2 py-0.5 text-[11px] text-red-200">+ДДС</span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-400">
                        {snap.last_edit ? formatDate(snap.last_edit) : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-300">
                        {snap.ad_status && snap.ad_status !== 'none' ? snap.ad_status : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-300">
                        {snap.kaparo ? 'К' : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-xs text-gray-300">
                        <div className="line-clamp-2">{snap.title || '—'}</div>
                      </td>
                      <td className="max-w-md px-4 py-3 text-xs text-gray-400">
                        <div className="line-clamp-3 whitespace-pre-wrap">{snap.description || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {delta === null ? (
                          <span className="text-gray-600">—</span>
                        ) : delta === 0 ? (
                          <span className="text-gray-500">no change</span>
                        ) : (
                          <span
                            className={
                              delta < 0 ? 'text-green-400' : 'text-red-400'
                            }
                          >
                            {delta < 0 ? '↓' : '↑'} {formatPrice(deltaAbs!)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Timeline visualization */}
        {pricePoints.length > 1 && (
          <div className="mt-6 rounded-lg border border-gray-700/60 bg-gray-800/40 p-4">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Price Timeline
            </h2>
            <div className="relative">
              {(() => {
                const prices = pricePoints.map((s) => s.price);
                const minP = Math.min(...prices);
                const maxP = Math.max(...prices);
                const range = maxP - minP || 1;
                const barH = 80;

                return (
                  <div className="flex items-end gap-1 overflow-x-auto" style={{ height: barH + 24 }}>
                    {pricePoints.map((snap, i) => {
                      const h = barH * 0.35 + ((snap.price - minP) / range) * barH * 0.65;
                      const prev = pricePoints[i - 1];
                      const delta = prev ? snap.price - prev.price : 0;
                      const isLast = i === pricePoints.length - 1;
                      const color =
                        i === 0
                          ? 'bg-gray-500'
                          : isLast
                          ? 'bg-blue-500'
                          : delta < 0
                          ? 'bg-green-500'
                          : delta > 0
                          ? 'bg-red-500'
                          : 'bg-gray-500';
                      return (
                        <div
                          key={i}
                          className="group relative flex flex-col items-center flex-shrink-0"
                          style={{ width: Math.max(40, Math.min(80, 600 / pricePoints.length)) }}
                        >
                          <div
                            className={`w-full rounded-t ${color} transition-opacity group-hover:opacity-80`}
                            style={{ height: h }}
                          />
                          <div className="mt-1 text-center text-[10px] leading-tight text-gray-500">
                            <div>{formatDateAxis(snap.recorded_at)}</div>
                            <div>{formatDate(snap.recorded_at).split(' ')[1] ?? ''}</div>
                          </div>
                          {/* Tooltip */}
                          <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block whitespace-nowrap">
                            {formatPrice(snap.price)}
                            <br />
                            {formatDate(snap.recorded_at)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
