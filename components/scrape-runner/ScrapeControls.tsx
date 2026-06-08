'use client';

import { useTranslations } from 'next-intl';
import type { ScrapeDealer, ScrapeSource } from '@/components/scrape-runner/types';

interface ScrapeControlsProps {
  source: ScrapeSource;
  running: boolean;
  stopping: boolean;
  deepCrawl: boolean;
  downloadImages: boolean;
  activeDealers: ScrapeDealer[];
  availableDealers: ScrapeDealer[];
  effectiveSelected: string[];
  allActiveSelected: boolean;
  onSourceChange: (source: ScrapeSource) => void;
  onToggleDealer: (slug: string) => void;
  onToggleSelectAllDealers: () => void;
  onToggleDeepCrawl: () => void;
  onToggleDownloadImages: () => void;
  onRunClick: () => void;
}

export function ScrapeControls({
  source,
  running,
  stopping,
  deepCrawl,
  downloadImages,
  activeDealers,
  availableDealers,
  effectiveSelected,
  allActiveSelected,
  onSourceChange,
  onToggleDealer,
  onToggleSelectAllDealers,
  onToggleDeepCrawl,
  onToggleDownloadImages,
  onRunClick,
}: ScrapeControlsProps) {
  const t = useTranslations('ui');
  return (
    <div className="space-y-5 rounded-lg border border-gray-700 bg-gray-800/60 p-6">
      <div className="flex w-fit items-center gap-1 rounded-lg bg-gray-900/60 p-1">
        <button
          onClick={() => onSourceChange('mobile')}
          disabled={running}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${source === 'mobile' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'} disabled:opacity-50`}
        >
          mobile.bg
        </button>
        <button
          onClick={() => onSourceChange('carsbg')}
          disabled={running}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${source === 'carsbg' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-orange-300'} disabled:opacity-50`}
        >
          cars.bg
        </button>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-300">
          <span>{t('dealers')}</span>
          <span className="text-xs text-gray-500">({effectiveSelected.length} selected)</span>
          <button
            type="button"
            onClick={onToggleSelectAllDealers}
            disabled={running || availableDealers.length === 0}
            className="text-xs font-medium text-blue-400 transition-colors hover:text-blue-300 disabled:cursor-not-allowed disabled:text-gray-600"
          >
            {allActiveSelected ? t('deselect_all') : t('select_all')}
          </button>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {activeDealers.map((dealer) => {
            const isAvailableForSource = Boolean(source === 'mobile' ? dealer.mobile_url : dealer.cars_url);
            return (
              <label key={dealer.slug} className={`flex items-center gap-2 select-none ${isAvailableForSource ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                <input
                  type="checkbox"
                  checked={effectiveSelected.includes(dealer.slug)}
                  onChange={() => onToggleDealer(dealer.slug)}
                  disabled={running || !isAvailableForSource}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 disabled:opacity-50"
                />
                <span className={`text-sm ${isAvailableForSource ? 'text-gray-200' : 'text-gray-500'}`}>{dealer.name}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={onRunClick}
          disabled={(!running && effectiveSelected.length === 0) || stopping}
          className={`flex items-center gap-2 rounded-md px-5 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            running ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'
          }`}
        >
          {(running || stopping) && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {stopping ? t('stopping') : running ? t('stop') : t('run')}
        </button>

        <div
          onClick={onToggleDeepCrawl}
          className={`flex items-center gap-3 ${running ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        >
          <div
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${deepCrawl ? 'bg-blue-600' : 'bg-gray-600'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${deepCrawl ? 'translate-x-6' : 'translate-x-1'}`} />
          </div>
          <div>
            <span className="text-sm font-medium text-gray-200">{t('deep_crawl')}</span>
            <p className="mt-0.5 text-xs text-gray-400">{t('deep_crawl_desc')}</p>
          </div>
        </div>

        <div
          onClick={onToggleDownloadImages}
          className={`flex items-center gap-3 ${(running || !deepCrawl) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        >
          <div
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${downloadImages && deepCrawl ? 'bg-blue-600' : 'bg-gray-600'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${downloadImages && deepCrawl ? 'translate-x-6' : 'translate-x-1'}`} />
          </div>
          <div>
            <span className="text-sm font-medium text-gray-200">{t('download_images')}</span>
            <p className="mt-0.5 text-xs text-gray-400">{t('download_images_desc')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
