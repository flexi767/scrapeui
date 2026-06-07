
import Link from 'next/link';
import SearchPositionsRunner from '@/components/SearchPositionsRunner';

export default function EditOwnSearchPositionsPage() {
  return (
    <div className="min-h-screen bg-[#111827]">
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/editown" className="text-sm text-gray-400 transition-colors hover:text-gray-200">
              ← Edit Own
            </Link>
            <span className="text-sm font-medium text-gray-400">Search Positions</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <SearchPositionsRunner />
      </main>
    </div>
  );
}
