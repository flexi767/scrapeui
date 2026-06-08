import CarsBgSyncRunner from '@/components/CarsBgSyncRunner';
import { getOwnDealers } from '@/lib/queries';

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
