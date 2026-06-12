import dynamic from 'next/dynamic';
import { getOwnDealers } from '@/lib/queries';

const CarsBgSyncRunner = dynamic(() => import('@/components/CarsBgSyncRunner'), {
  loading: () => <div className="rounded-lg border border-gray-700/60 bg-gray-900/40 p-6 text-sm text-gray-400">Loading cars.bg sync...</div>,
});

export default async function EditOwnCarsBgSyncPage() {
  const dealers = getOwnDealers({ activeOnly: true });

  return (
    <div className="min-h-screen bg-[#111827]">
      <main className="mx-auto max-w-[1400px] px-4 py-6">
        <CarsBgSyncRunner dealers={dealers} />
      </main>
    </div>
  );
}
