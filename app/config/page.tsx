import Link from 'next/link';
import ScrapeRunner from '@/components/ScrapeRunner';

export default function ConfigPage() {
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

      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-xl font-semibold text-white mb-6">Run Scraper</h1>
        <ScrapeRunner />
      </main>
    </div>
  );
}
