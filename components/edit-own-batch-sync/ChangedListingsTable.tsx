import { formatDate, formatPrice } from '@/lib/utils';
import { getPriceWithVat } from '@/lib/vat';
import { buildChangeRows } from './helpers';
import { SyncBadge } from './SyncBadge';
import type { BatchRow } from './types';

export function ChangedListingsTable({
  rows,
  running,
  revertingId,
  onRevert,
}: {
  rows: BatchRow[];
  running: boolean;
  revertingId: number | null;
  onRevert: (row: BatchRow) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-700/60">
      <table className="w-full text-sm">
        <thead className="bg-gray-800/70 text-xs uppercase tracking-wider text-gray-400">
          <tr>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Listing</th>
            <th className="px-3 py-2 text-left">Changes</th>
            <th className="px-3 py-2 text-left">Dealer</th>
            <th className="px-3 py-2 text-right">Price</th>
            <th className="px-3 py-2 text-right">Updated</th>
            <th className="px-3 py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50 bg-gray-900/40">
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                No changed listings are waiting for sync.
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const changes = buildChangeRows(row);
            const canRevert = !running && row.needs_sync === 1 && changes.length > 0;

            return (
              <tr key={row.backup_id} className="align-top">
                <td className="px-3 py-3">
                  <div className="space-y-1">
                    <SyncBadge status={row.runStatus} error={row.runError} />
                    {row.runError && (
                      <div className="max-w-xs text-xs text-red-300">{row.runError}</div>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="font-medium text-white">{row.make ?? '—'} {row.model ?? ''}</div>
                  <div className="text-xs text-gray-400">{row.title || '—'}</div>
                  <div className="text-[11px] text-gray-500">mobile.bg #{row.mobile_id}</div>
                </td>
                <td className="px-3 py-3">
                  {changes.length > 0 ? (
                    <div className="space-y-1 text-xs">
                      {changes.map((change) => (
                        <div key={change.label}>
                          <div>
                            <span className="text-gray-500">{change.label}:</span>{' '}
                            <span className="text-gray-400">{change.oldValue}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">→</span>{' '}
                            <span className="text-gray-200">{change.newValue}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-600">No pending field changes</span>
                  )}
                </td>
                <td className="px-3 py-3 text-gray-300">{row.dealer_name ?? '—'}</td>
                <td className="px-3 py-3 text-right">
                  <div className="font-medium text-green-400">
                    {formatPrice(row.current_price)}
                  </div>
                  {getPriceWithVat(row.current_price, row.vat) != null && (
                    <div className="text-xs text-emerald-200/85">
                      {formatPrice(getPriceWithVat(row.current_price, row.vat))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-right text-xs text-gray-400">
                  {row.completedAt ? formatDate(row.completedAt) : '—'}
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    onClick={() => onRevert(row)}
                    disabled={!canRevert || revertingId === row.backup_id}
                    className="rounded-md border border-gray-700 px-2.5 py-1 text-xs text-gray-200 hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {revertingId === row.backup_id ? 'Reverting…' : 'Revert'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
