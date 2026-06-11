'use client';

import { Copy, X } from "lucide-react";
import { useTranslations } from "next-intl";

export function ActiveBrowserImportCard({
  bookmarkletHref,
  browserImportTimedOut,
  onCancelBrowserImport,
  onReopenBrowserSearch,
}: {
  bookmarkletHref: string;
  browserImportTimedOut?: boolean;
  onCancelBrowserImport?: () => void;
  onReopenBrowserSearch?: () => void;
}) {
  const t = useTranslations('ui');

  return (
    <div className="mx-auto mt-4 max-w-2xl rounded-md border border-cyan-700/50 bg-cyan-950/30 p-3 text-left text-xs leading-5 text-cyan-100/85">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-cyan-100">{t('parser_bookmarklet')}</div>
        <div className="flex items-center gap-2">
          {browserImportTimedOut && onReopenBrowserSearch ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-amber-600/60 bg-amber-900/50 px-2.5 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-800"
              onClick={onReopenBrowserSearch}
            >
              {t('open_again')}
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-cyan-600/60 bg-cyan-900/60 px-2.5 py-1 text-xs font-semibold text-white hover:bg-cyan-800"
            onClick={() => void navigator.clipboard?.writeText(bookmarkletHref)}
          >
            <Copy className="h-3.5 w-3.5" />
            {t('copy')}
          </button>
          {onCancelBrowserImport ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded border border-slate-600/70 bg-slate-900/70 px-2.5 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-800"
              onClick={onCancelBrowserImport}
            >
              <X className="h-3.5 w-3.5" />
              {t('cancel')}
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-1 text-cyan-100/75">{t('bookmarklet_desc')}</div>
      <textarea
        readOnly
        value={bookmarkletHref}
        className="mt-2 h-20 w-full resize-none rounded border border-cyan-800/70 bg-slate-950/70 p-2 font-mono text-[11px] leading-4 text-cyan-50 outline-none"
        onFocus={(event) => event.currentTarget.select()}
      />
    </div>
  );
}

export function InstallBookmarkletCard({
  installBookmarkletHref,
}: {
  installBookmarkletHref: string;
}) {
  const t = useTranslations('ui');

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/70 px-4 py-3 text-sm text-gray-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium text-white">{t('browser_parser_bookmarklet')}</div>
          <div className="mt-1 text-xs text-gray-400">{t('install_bookmarklet_desc')}</div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded border border-cyan-700/60 bg-cyan-950/70 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-900"
          onClick={() => void navigator.clipboard?.writeText(installBookmarkletHref)}
        >
          <Copy className="h-3.5 w-3.5" />
          {t('copy_bookmarklet')}
        </button>
      </div>
    </div>
  );
}
