'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import DealersManager from './DealersManager';
import type { Dealer } from './dealers/types';

const ScrapeRunner = dynamic(() => import('./ScrapeRunner'), {
  loading: () => <div className="rounded-lg border border-gray-700/60 bg-gray-900/40 p-6 text-sm text-gray-400">Loading scraper...</div>,
});

export default function ConfigShell({ initialDealers }: { initialDealers: Dealer[] }) {
  const t = useTranslations('ui');
  const [dealers, setDealers] = useState<Dealer[]>(initialDealers);
  const [dealersCollapsed, setDealersCollapsed] = useState(false);

  return (
    <>
      <section>
        <button
          onClick={() => setDealersCollapsed(v => !v)}
          className="mb-4 flex items-center gap-2 text-lg font-semibold text-white"
        >
          <span>{dealersCollapsed ? '▶' : '▼'}</span>
          <span>{t('dealers')}</span>
        </button>
        {!dealersCollapsed && (
          <DealersManager initialDealers={dealers} onDealersChange={setDealers} />
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white mb-4">{t('run_scraper')}</h2>
        <ScrapeRunner initialDealers={dealers} onRunStart={() => setDealersCollapsed(true)} />
      </section>
    </>
  );
}
