'use client';

import { useState } from 'react';
import DealersManager from './DealersManager';
import type { Dealer } from './dealers/types';
import ScrapeRunner from './ScrapeRunner';

export default function ConfigShell({ initialDealers }: { initialDealers: Dealer[] }) {
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
          <span>Dealers</span>
        </button>
        {!dealersCollapsed && (
          <DealersManager initialDealers={dealers} onDealersChange={setDealers} />
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Run Scraper</h2>
        <ScrapeRunner initialDealers={dealers} onRunStart={() => setDealersCollapsed(true)} />
      </section>
    </>
  );
}
