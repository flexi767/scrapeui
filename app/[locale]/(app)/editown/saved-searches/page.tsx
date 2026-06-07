
import Link from 'next/link';
import SavedSearchesWorkspace from '@/components/SavedSearchesWorkspace';
import { getSavedSearchDetail, listSavedSearchSummaries } from '@/lib/mobile-bg/saved-searches';

export default async function EditOwnSavedSearchesPage() {
  const searches = listSavedSearchSummaries();
  const initialDetail = searches.length > 0 ? await getSavedSearchDetail(searches[0].id) : null;

  return (
    <div className="min-h-screen bg-[#111827]">
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm font-medium text-gray-200">Saved Searches</div>
            <div className="text-xs text-gray-500">
              Edit saved mobile.bg searches, run them inline, and save variants as new searches.
            </div>
          </div>
          <Link href="/editown" className="text-sm text-gray-400 hover:text-gray-200">
            ← Back to editown
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6">
        <SavedSearchesWorkspace initialSearches={searches} initialDetail={initialDetail} />
      </main>
    </div>
  );
}
