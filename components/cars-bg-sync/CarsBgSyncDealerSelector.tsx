import type { DealerRow } from '@/lib/queries';

interface CarsBgSyncDealerSelectorProps {
  dealers: DealerRow[];
  selectedDealers: string[];
  running: boolean;
  allSelected: boolean;
  onToggleDealer: (slug: string) => void;
  onToggleAll: () => void;
}

export function CarsBgSyncDealerSelector({
  dealers,
  selectedDealers,
  running,
  allSelected,
  onToggleDealer,
  onToggleAll,
}: CarsBgSyncDealerSelectorProps) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-gray-200">Dealers</div>
          <div className="mt-1 text-xs text-gray-500">
            Select one or more own dealers for preview or live sync.
          </div>
        </div>
        <button
          type="button"
          disabled={running || dealers.length === 0}
          onClick={onToggleAll}
          className="rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {allSelected ? 'Clear all' : 'Select all'}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {dealers.map((dealer) => {
          const selected = selectedDealers.includes(dealer.slug);
          return (
            <button
              key={dealer.slug}
              type="button"
              disabled={running}
              onClick={() => onToggleDealer(dealer.slug)}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                selected
                  ? 'border-sky-500 bg-sky-500/15 text-sky-200'
                  : 'border-gray-700 bg-gray-900/80 text-gray-400 hover:border-gray-500 hover:text-gray-200'
              }`}
            >
              {dealer.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
