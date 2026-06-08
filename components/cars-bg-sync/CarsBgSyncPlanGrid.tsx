'use client';

import { useTranslations } from 'next-intl';
import { formatPrice } from '@/lib/utils';
import { listingLabel } from '@/components/cars-bg-sync/helpers';
import type { DiffItem, MissingItem, StaleCarsItem } from '@/components/cars-bg-sync/types';

interface CarsBgSyncPlanGridProps {
  missing: MissingItem[];
  diffs: DiffItem[];
  staleCarsIds: StaleCarsItem[];
  openDescriptionKey: string | null;
  onToggleDescription: (key: string) => void;
}

export function CarsBgSyncPlanGrid({
  missing,
  diffs,
  staleCarsIds,
  openDescriptionKey,
  onToggleDescription,
}: CarsBgSyncPlanGridProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <MissingListingsCard missing={missing} />
      <DiffListingsCard diffs={diffs} openDescriptionKey={openDescriptionKey} onToggleDescription={onToggleDescription} />
      <StaleOffersCard staleCarsIds={staleCarsIds} />
    </div>
  );
}

function MissingListingsCard({ missing }: { missing: MissingItem[] }) {
  const t = useTranslations('ui');
  return (
    <PlanCard title={t('missing_on_carsbg')} empty={missing.length === 0 ? t('no_missing_listings') : null}>
      {missing.map((item, index) => (
        <div key={`${item.mobileId || index}`} className="px-4 py-3 text-sm">
          <div className="text-white">{listingLabel(item)}</div>
          <div className="mt-1 text-xs text-gray-500">
            {item.dealer}
            {item.mobileId ? ` • mobile.bg #${item.mobileId}` : ''}
            {item.price != null ? ` • ${formatPrice(item.price)}` : ''}
          </div>
        </div>
      ))}
    </PlanCard>
  );
}

function DiffListingsCard({
  diffs,
  openDescriptionKey,
  onToggleDescription,
}: {
  diffs: DiffItem[];
  openDescriptionKey: string | null;
  onToggleDescription: (key: string) => void;
}) {
  const t = useTranslations('ui');
  return (
    <PlanCard title={t('price_diffs')} empty={diffs.length === 0 ? t('no_price_diffs') : null}>
      {diffs.map((item, index) => {
        const diffKey = `${item.mobileId || item.carsId || index}`;
        const descriptionOpen = openDescriptionKey === diffKey;
        return (
          <div key={diffKey} className="px-4 py-3 text-sm">
            <div className="text-white">{listingLabel(item)}</div>
            <div className="mt-1 text-xs text-gray-500">
              {item.dealer}
              {item.mobileId ? ` • mobile.bg #${item.mobileId}` : ''}
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
              {item.priceDiff && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-200">{t('price_label')}</span>
              )}
              {item.titleDiff && (
                <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-200">{t('title_label')}</span>
              )}
              {item.descriptionDiff && (
                <button
                  type="button"
                  onClick={() => onToggleDescription(diffKey)}
                  className="rounded-full bg-violet-500/15 px-2 py-0.5 text-violet-200 transition-colors hover:bg-violet-500/25"
                >
                  {t('description_label')}
                </button>
              )}
            </div>
            {item.priceDiff && (
              <div className="mt-1 text-xs">
                <span className="text-gray-500">cars.bg:</span>{' '}
                <span className="text-gray-300">{formatPrice(item.oldPrice)}</span>
                <span className="mx-1 text-gray-600">→</span>
                <span className="text-white">{formatPrice(item.newPrice)}</span>
              </div>
            )}
            {item.titleDiff && (
              <div className="mt-1 text-xs">
                <span className="text-gray-500">title:</span>{' '}
                <span className="text-gray-300">{item.oldTitle?.trim() || '—'}</span>
                <span className="mx-1 text-gray-600">→</span>
                <span className="text-white">{item.newTitle?.trim() || '—'}</span>
              </div>
            )}
            {descriptionOpen && item.descriptionDiff && (
              <div className="mt-3 grid gap-3 xl:grid-cols-2">
                <div className="rounded-lg border border-gray-700/60 bg-gray-950/40 p-3">
                  <div className="mb-2 text-[11px] uppercase tracking-wide text-gray-500">{t('old')}</div>
                  <div className="whitespace-pre-wrap text-xs text-gray-300">
                    {item.oldDescription?.trim() || '—'}
                  </div>
                </div>
                <div className="rounded-lg border border-gray-700/60 bg-gray-950/40 p-3">
                  <div className="mb-2 text-[11px] uppercase tracking-wide text-gray-500">{t('new')}</div>
                  <div className="whitespace-pre-wrap text-xs text-gray-200">
                    {item.newDescription?.trim() || '—'}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </PlanCard>
  );
}

function StaleOffersCard({ staleCarsIds }: { staleCarsIds: StaleCarsItem[] }) {
  const t = useTranslations('ui');
  return (
    <PlanCard title={t('stale_carsbg_offers')} empty={staleCarsIds.length === 0 ? t('no_stale_offers') : null}>
      {staleCarsIds.map((item, index) => (
        <div key={`${item.carsId || index}`} className="px-4 py-3 text-sm">
          <div className="text-white">{item.carsId || 'Unknown cars.bg id'}</div>
          <div className="mt-1 text-xs text-gray-500">{item.dealer}</div>
        </div>
      ))}
    </PlanCard>
  );
}

function PlanCard({ title, empty, children }: { title: string; empty: string | null; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-700/60">
      <div className="border-b border-gray-700/60 bg-gray-800/70 px-4 py-3 text-sm font-medium text-gray-200">
        {title}
      </div>
      <div className="divide-y divide-gray-700/40 bg-gray-900/40">
        {empty ? <div className="px-4 py-6 text-sm text-gray-500">{empty}</div> : children}
      </div>
    </div>
  );
}
