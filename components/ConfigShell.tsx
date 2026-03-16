'use client';

import { useState } from 'react';
import DealersManager from './DealersManager';
import ScrapeRunner from './ScrapeRunner';

interface Dealer {
  id: number;
  slug: string;
  name: string;
  mobile_url: string | null;
  own: number;
  active: number;
  priority: number;
  cars_url: string | null;
  mobile_user: string | null;
  mobile_password: string | null;
  cars_user: string | null;
  cars_password: string | null;
  created_at?: string | null;
}

export default function ConfigShell({ initialDealers }: { initialDealers: Dealer[] }) {
  const [dealers, setDealers] = useState<Dealer[]>(initialDealers);

  return (
    <>
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Dealers</h2>
        <DealersManager initialDealers={dealers} onDealersChange={setDealers} />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Run Scraper</h2>
        <ScrapeRunner initialDealers={dealers} />
      </section>
    </>
  );
}
