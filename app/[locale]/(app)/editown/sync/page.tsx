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
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-[1400px] px-4 py-3">
          <div>
            <div className="text-sm font-medium text-gray-200">Batch Sync</div>
            <div className="text-xs text-gray-500">
              Sync changed own listings back to Mobile.bg
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6">
        <EditOwnBatchSync initialRows={rows} autoRun={sp.autorun === '1'} ownDealers={ownDealers} />
      </main>
    </div>
  );
}
