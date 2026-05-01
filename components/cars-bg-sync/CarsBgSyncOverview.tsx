import type { CarsBgSyncTotals } from '@/components/cars-bg-sync/types';

interface CarsBgSyncOverviewProps {
  totals: CarsBgSyncTotals;
  running: boolean;
  liveMode: boolean;
  doneSummary: CarsBgSyncTotals | null;
}

export function CarsBgSyncOverview({ totals, running, liveMode, doneSummary }: CarsBgSyncOverviewProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <MetricCard label="Missing" value={totals.missing} valueClassName="text-white" />
      <MetricCard label="Diffs" value={totals.diffs} valueClassName="text-amber-300" />
      <MetricCard label="Stale" value={totals.stale} valueClassName="text-red-300" />
      <MetricCard label="Updated" value={totals.updated} valueClassName="text-sky-300" />
      <MetricCard label="Created" value={totals.created} valueClassName="text-emerald-400" />
      <MetricCard label="Deleted" value={totals.deleted} valueClassName="text-red-400" />
      <div className="ml-auto rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-right text-sm">
        <span className="uppercase tracking-wide text-gray-500">Mode</span>
        <span className="ml-2 text-sm font-medium text-gray-100">
          {running ? (liveMode ? 'Running live' : 'Planning') : (doneSummary ? (liveMode ? 'Last run live' : 'Last preview') : 'Idle')}
        </span>
      </div>
    </div>
  );
}

function MetricCard({ label, value, valueClassName }: { label: string; value: number; valueClassName: string }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-2.5 text-sm">
      <span className="uppercase tracking-wide text-gray-500">{label}</span>
      <span className={`ml-2 text-lg font-semibold ${valueClassName}`}>{value}</span>
    </div>
  );
}
