import type { SavedSearchSummary } from "@/lib/mobile-bg/saved-searches";

function formatYear(search: SavedSearchSummary) {
  if (search.yearFrom && search.yearTo)
    return `${search.yearFrom} - ${search.yearTo}`;
  if (search.yearFrom) return `from ${search.yearFrom}`;
  if (search.yearTo) return `to ${search.yearTo}`;
  if (search.regYear) return search.regYear;
  return "—";
}

export function SavedSearchList({
  searches,
  selectedId,
  onSelect,
}: {
  searches: SavedSearchSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900/70">
      <div className="border-b border-gray-700 px-4 py-3">
        <div className="text-sm font-medium text-gray-200">Saved searches</div>
        <div className="text-xs text-gray-500">{searches.length} total</div>
      </div>
      <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
        {searches.length === 0 ? (
          <div className="px-4 py-8 text-sm text-gray-500">
            No saved searches yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {searches.map((search) => {
              const active = search.id === selectedId;
              return (
                <button
                  key={search.id}
                  type="button"
                  onClick={() => onSelect(search.id)}
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    active ? "bg-gray-800/80" : "hover:bg-gray-800/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">
                        {[search.make, search.model].filter(Boolean).join(" ") ||
                          search.title ||
                          "—"}
                      </div>
                      <div className="truncate text-xs text-gray-400">
                        Year: {formatYear(search)}
                      </div>
                      {search.mobileId ? (
                        <div className="mt-1 truncate text-[11px] text-gray-500">
                          Entry: {search.title || "—"} • {search.mobileId}
                        </div>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-[11px] text-gray-500">
                      #{search.id}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
