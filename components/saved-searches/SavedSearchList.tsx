'use client';

import { useTranslations } from "next-intl";
import type { SavedSearchSummary } from "@/lib/mobile-bg/saved-searches";

function formatYear(search: SavedSearchSummary, yearFromLabel: string, yearToLabel: string) {
  if (search.yearFrom && search.yearTo)
    return `${search.yearFrom} - ${search.yearTo}`;
  if (search.yearFrom) return `${yearFromLabel} ${search.yearFrom}`;
  if (search.yearTo) return `${yearToLabel} ${search.yearTo}`;
  if (search.regYear) return search.regYear;
  return "—";
}

function SavedSearchListRow({
  search,
  active,
  onSelect,
}: {
  search: SavedSearchSummary;
  active: boolean;
  onSelect: (id: number) => void;
}) {
  const t = useTranslations('ui');
  const title =
    [search.make, search.model].filter(Boolean).join(" ") ||
    search.title ||
    "—";

  return (
    <button
      type="button"
      onClick={() => onSelect(search.id)}
      className={`w-full px-4 py-3 text-left transition-colors ${
        active ? "bg-gray-800/80" : "hover:bg-gray-800/40"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white">{title}</div>
          <div className="truncate text-xs text-gray-400">
            {t('year_label')}: {formatYear(search, t('year_from'), t('year_to'))}
          </div>
          {search.mobileId ? (
            <div className="mt-1 truncate text-[11px] text-gray-500">
              {t('entry_label')}: {search.title || "—"} • {search.mobileId}
            </div>
          ) : null}
        </div>
        <div className="shrink-0 text-[11px] text-gray-500">#{search.id}</div>
      </div>
    </button>
  );
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
  const t = useTranslations('ui');

  return (
    <section className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900/70">
      <div className="border-b border-gray-700 px-4 py-3">
        <div className="text-sm font-medium text-gray-200">{t('saved_searches')}</div>
        <div className="text-xs text-gray-500">{t('total_count', { count: searches.length })}</div>
      </div>
      <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
        {searches.length === 0 ? (
          <div className="px-4 py-8 text-sm text-gray-500">
            {t('no_saved_searches')}
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {searches.map((search) => (
              <SavedSearchListRow
                key={search.id}
                search={search}
                active={search.id === selectedId}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
