import dynamic from 'next/dynamic';

const SearchPositionsRunner = dynamic(() => import('@/components/SearchPositionsRunner'), {
  loading: () => <div className="rounded-lg border border-gray-700/60 bg-gray-900/40 p-6 text-sm text-gray-400">Loading search positions...</div>,
});

export default function EditOwnSearchPositionsPage() {
  return (
    <div className="min-h-screen bg-[#111827]">
      <main className="mx-auto max-w-5xl px-4 py-8">
        <SearchPositionsRunner />
      </main>
    </div>
  );
}
