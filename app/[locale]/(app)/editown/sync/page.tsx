
import dynamic from 'next/dynamic';
import { getOwnDealers, getPendingEditOwnSyncRows } from '@/lib/queries';

const EditOwnBatchSync = dynamic(() => import('@/components/EditOwnBatchSync'), {
  loading: () => <div className="rounded-lg border border-gray-700/60 bg-gray-900/40 p-6 text-sm text-gray-400">Loading sync workspace...</div>,
});

interface SearchParams {
  autorun?: string;
}

export default async function EditOwnSyncPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const rows = getPendingEditOwnSyncRows();
  const ownDealers = getOwnDealers({ activeOnly: true })
    .map((d) => ({ slug: d.slug, name: d.name }));

  return (
    <div className="min-h-screen bg-[#111827]">
      <main className="mx-auto max-w-[1400px] px-4 py-6">
        <EditOwnBatchSync initialRows={rows} autoRun={sp.autorun === '1'} ownDealers={ownDealers} />
      </main>
    </div>
  );
}
