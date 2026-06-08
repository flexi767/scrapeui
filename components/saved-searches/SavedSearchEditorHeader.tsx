'use client';

import {
  ExternalLink,
  Loader2,
  type LucideIcon,
  Plus,
  Save,
  SearchIcon,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { SavedSearchEditorListingSummary } from "@/components/saved-searches/SavedSearchEditorListingSummary";
import { Button } from "@/components/ui/button";
import type { SearchPrefillData } from "@/lib/mobile-bg/search-prefill";

type SavedSearchListing = SearchPrefillData["listing"];

function HeaderActionButton({
  label,
  className,
  icon: Icon,
  busy = false,
  disabled = false,
  onClick,
}: {
  label: string;
  className: string;
  icon: LucideIcon;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      onClick={onClick}
      disabled={disabled}
    >
      {busy ? (
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
      ) : (
        <Icon className="mr-1 h-4 w-4" />
      )}
      {label}
    </Button>
  );
}

export function SavedSearchEditorHeader({
  listing,
  resultsLoading,
  browserResultsLoading,
  saveAdMode,
  makeOrModelChanged,
  saveBusy,
  cloneBusy,
  deleteBusy,
  onShowFirst,
  onShowAll,
  onSearchInBrowser,
  onOpenMobileBg,
  onSaveAd,
  onSave,
  onSaveAsNew,
  onDelete,
}: {
  listing: SavedSearchListing;
  resultsLoading: boolean;
  browserResultsLoading: boolean;
  saveAdMode: boolean;
  makeOrModelChanged: boolean;
  saveBusy: boolean;
  cloneBusy: boolean;
  deleteBusy: boolean;
  onShowFirst: () => void;
  onShowAll: () => void;
  onSearchInBrowser: () => void;
  onOpenMobileBg: () => void;
  onSaveAd: () => void;
  onSave: () => void;
  onSaveAsNew: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('ui');
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-700 px-4 py-3">
      <SavedSearchEditorListingSummary listing={listing} />
      <div className="flex flex-wrap justify-end gap-2">
        <HeaderActionButton
          label={t('first_7')}
          icon={SearchIcon}
          className="border-gray-600 bg-gray-900/80 text-gray-200 hover:bg-gray-800 hover:text-white"
          onClick={onShowFirst}
          disabled={resultsLoading || browserResultsLoading}
        />
        <HeaderActionButton
          label={t('search_on_server')}
          icon={SearchIcon}
          busy={resultsLoading}
          className="border-sky-700 bg-sky-950/80 text-sky-200 hover:bg-sky-900 hover:text-white"
          onClick={onShowAll}
          disabled={resultsLoading || browserResultsLoading}
        />
        <HeaderActionButton
          label={t('open_browser_search')}
          icon={SearchIcon}
          busy={browserResultsLoading}
          className="border-cyan-700 bg-cyan-950/80 text-cyan-200 hover:bg-cyan-900 hover:text-white"
          onClick={onSearchInBrowser}
          disabled={resultsLoading || browserResultsLoading}
        />
        <HeaderActionButton
          label={t('open_mobile_bg')}
          icon={ExternalLink}
          className="border-gray-600 bg-gray-900/80 text-gray-200 hover:bg-gray-800 hover:text-white"
          onClick={onOpenMobileBg}
        />
        <HeaderActionButton
          label={t('save_ad')}
          icon={Plus}
          busy={resultsLoading && saveAdMode}
          className={
            saveAdMode
              ? "border-emerald-600 bg-emerald-900 text-white hover:bg-emerald-800"
              : "border-emerald-700 bg-emerald-950/80 text-emerald-200 hover:bg-emerald-900 hover:text-white"
          }
          onClick={onSaveAd}
          disabled={resultsLoading || browserResultsLoading}
        />
        {!makeOrModelChanged && (
          <HeaderActionButton
            label={t('save')}
            icon={Save}
            busy={saveBusy}
            className="border-emerald-700 bg-emerald-950/80 text-emerald-200 hover:bg-emerald-900 hover:text-white"
            onClick={onSave}
            disabled={saveBusy}
          />
        )}
        <HeaderActionButton
          label={t('save_as_new')}
          icon={Plus}
          busy={cloneBusy}
          className="border-amber-700 bg-amber-950/80 text-amber-200 hover:bg-amber-900 hover:text-white"
          onClick={onSaveAsNew}
          disabled={cloneBusy}
        />
        <HeaderActionButton
          label={t('delete')}
          icon={Trash2}
          busy={deleteBusy}
          className="border-red-700 bg-red-950/80 text-red-200 hover:bg-red-900 hover:text-white"
          onClick={onDelete}
          disabled={deleteBusy}
        />
      </div>
    </div>
  );
}
