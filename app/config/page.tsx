import Link from 'next/link';
import ScrapeRunner from '@/components/ScrapeRunner';
import DealersManager from '@/components/DealersManager';
import { raw } from '@/db/client';

interface DealerRow {
  id: number;
  slug: string;
  name: string;
  mobile_url: string | null;
  own: number;
  active: number;
  mobile_user: string | null;
  mobile_password: string | null;
  cars_user: string | null;
  cars_password: string | null;
  created_at: string | null;
}

function getDealers(): DealerRow[] {
  return raw.prepare('SELECT id, slug, name, mobile_url, own, active, mobile_user, mobile_password, cars_user, cars_password, created_at FROM dealers ORDER BY name').all() as DealerRow[];
}

export default function ConfigPage() {
  const dealers = getDealers();

  return (
    <div className="min-h-screen bg-[#111827]">
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-[1600px] px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
              ← Listings
            </Link>
            <span className="text-sm font-medium text-gray-400">⚙ Config</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 space-y-10">
        {/* Dealers manager */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Dealers</h2>
          <DealersManager initialDealers={dealers} />
        </section>

        {/* Scraper runner */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Run Scraper</h2>
          <ScrapeRunner initialDealers={dealers} />
        </section>
      </main>
    </div>
  );
}
