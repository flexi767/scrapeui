
import EditOwnBatchSync from '@/components/EditOwnBatchSync';
import { getAllDealers, getEditOwnSyncRows } from '@/lib/queries';

interface SearchParams {
  autorun?: string;
}

export default async function EditOwnSyncPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const rows = getEditOwnSyncRows().filter((row) => row.needs_sync === 1);
  const ownDealers = getAllDealers()
    .filter((d) => d.own && d.active)
    .map((d) => ({ slug: d.slug, name: d.name }));

  return (
    <div className="min-h-screen bg-[#111827]">
      <main className="mx-auto max-w-[1400px] px-4 py-6">
        <EditOwnBatchSync initialRows={rows} autoRun={sp.autorun === '1'} ownDealers={ownDealers} />
      </main>
    </div>
  );
}
