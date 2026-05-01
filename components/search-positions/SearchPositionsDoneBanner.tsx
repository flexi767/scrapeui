import type { SearchPositionSummary } from '@/components/search-positions/types';

interface SearchPositionsDoneBannerProps {
  doneSummary: SearchPositionSummary | null;
}

export function SearchPositionsDoneBanner({ doneSummary }: SearchPositionsDoneBannerProps) {
  if (!doneSummary) return null;

  return (
    <div className="rounded-lg border border-green-700/60 bg-green-900/20 px-4 py-3 text-sm text-green-400">
      Checked {doneSummary.total} listings • found {doneSummary.found} • missing {doneSummary.notFound}
    </div>
  );
}
