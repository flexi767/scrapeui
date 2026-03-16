import Link from 'next/link';
import ScrapeRunner from '@/components/ScrapeRunner';
import CompetitorsManager from '@/components/CompetitorsManager';
import { raw } from '@/db/client';

interface CompetitorRow {
  id: number;
  slug: string;
  name: string;
  mobile_url: string;
  active: number;
  created_at: string;
}

function getCompetitors(): CompetitorRow[] {
  return raw.prepare('SELECT * FROM competitors ORDER BY name').all() as CompetitorRow[];
}

export default function ConfigPage() {
  const competitors = getCompetitors();

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
        {/* Competitors manager */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Competitors</h2>
          <CompetitorsManager initialCompetitors={competitors} />
        </section>

        {/* Scraper runner */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Run Scraper</h2>
          <ScrapeRunner initialCompetitors={competitors} />
        </section>
      </main>
    </div>
  );
}
