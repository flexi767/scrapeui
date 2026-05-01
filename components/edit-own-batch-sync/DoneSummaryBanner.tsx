import type { RunStats } from './types';

export function DoneSummaryBanner({ summary }: { summary: RunStats | null }) {
  if (!summary) return null;

  return (
    <div className="rounded-lg border border-green-700/60 bg-green-900/20 px-4 py-3 text-sm text-green-400">
      Completed {summary.completed} of {summary.total} listings • success {summary.succeeded} • failed {summary.failed}
    </div>
  );
}
