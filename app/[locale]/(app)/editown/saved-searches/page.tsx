import SavedSearchesWorkspace from '@/components/SavedSearchesWorkspace';
import { getSavedSearchDetail, listSavedSearchSummaries } from '@/lib/mobile-bg/saved-searches';

export default async function EditOwnSavedSearchesPage() {
  const searches = listSavedSearchSummaries();
  const initialDetail = searches.length > 0 ? await getSavedSearchDetail(searches[0].id) : null;

  return (
    <div className="min-h-screen bg-[#111827]">
      <main className="mx-auto max-w-[1600px] px-4 py-6">
        <SavedSearchesWorkspace initialSearches={searches} initialDetail={initialDetail} />
      </main>
    </div>
  );
}
