import { formatDate } from '@/lib/utils';
import { labelForRow } from './helpers';
import { SyncBadge } from './SyncBadge';
import type { BatchRow } from './types';

export function RecentResults({ rows }: { rows: BatchRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/70 overflow-hidden">
      <div className="border-b border-gray-700 px-4 py-3 text-sm font-medium text-gray-300">Recent results</div>
      <div className="divide-y divide-gray-800">
        {rows.map((row) => (
          <div key={row.backup_id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <div className="min-w-0">
              <div className="truncate text-gray-200">{labelForRow(row)}</div>
              <div className="mt-1 text-xs text-gray-500">
                {row.mobile_id ? `mobile.bg #${row.mobile_id}` : `backup ${row.backup_id}`}
                {row.completedAt ? ` • ${formatDate(row.completedAt)}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {row.runError && <div className="max-w-xs truncate text-xs text-red-300">{row.runError}</div>}
              <SyncBadge status={row.runStatus} error={row.runError} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
