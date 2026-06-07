import CarsBgSyncRunner from '@/components/CarsBgSyncRunner';
import { getAllDealers } from '@/lib/queries';

export default async function EditOwnCarsBgSyncPage() {
  const dealers = getAllDealers().filter((dealer) => dealer.own === 1 && dealer.active === 1);

  return (
    <div className="min-h-screen bg-[#111827]">
      <main className="mx-auto max-w-[1400px] px-4 py-6">
        <CarsBgSyncRunner dealers={dealers} />
      </main>
    </div>
  );
}
