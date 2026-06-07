
import Link from 'next/link';
import CarsBgSyncRunner from '@/components/CarsBgSyncRunner';
import { getAllDealers } from '@/lib/queries';

export default function EditOwnCarsBgSyncPage() {
  const dealers = getAllDealers().filter((dealer) => dealer.own === 1 && dealer.active === 1);

  return (
    <div className="min-h-screen bg-[#111827]">
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm font-medium text-gray-200">Cars.bg Sync</div>
            <div className="text-xs text-gray-500">
              Preview and run Mobile.bg → Cars.bg sync for own dealers
            </div>
          </div>
          <Link href="/editown" className="text-sm text-gray-400 hover:text-gray-200">
            ← Back to editown
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6">
        <CarsBgSyncRunner dealers={dealers} />
      </main>
    </div>
  );
}
