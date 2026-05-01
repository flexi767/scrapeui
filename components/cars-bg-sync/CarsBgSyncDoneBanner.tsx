import type { CarsBgSyncTotals } from '@/components/cars-bg-sync/types';

interface CarsBgSyncDoneBannerProps {
  doneSummary: CarsBgSyncTotals | null;
  liveMode: boolean;
}

export function CarsBgSyncDoneBanner({ doneSummary, liveMode }: CarsBgSyncDoneBannerProps) {
  if (!doneSummary) return null;

  return (
    <div className="rounded-lg border border-green-700/60 bg-green-900/20 px-4 py-3 text-sm text-green-400">
      {liveMode
        ? `Live run finished • updated ${doneSummary.updated} • created ${doneSummary.created} • deleted ${doneSummary.deleted}`
        : `Plan ready • missing ${doneSummary.missing} • diffs ${doneSummary.diffs} • stale ${doneSummary.stale}`}
    </div>
  );
}
