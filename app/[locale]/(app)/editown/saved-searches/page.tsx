
import Link from 'next/link';
import SavedSearchesWorkspace from '@/components/SavedSearchesWorkspace';
import { getSavedSearchDetail, listSavedSearchSummaries } from '@/lib/mobile-bg/saved-searches';
import { getTranslations } from 'next-intl/server';

export default async function EditOwnSavedSearchesPage() {
  const t = await getTranslations('ui');
  const searches = listSavedSearchSummaries();
  const initialDetail = searches.length > 0 ? await getSavedSearchDetail(searches[0].id) : null;

  return (
    <div className="min-h-screen bg-[#111827]">
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm font-medium text-gray-200">{t('saved_searches')}</div>
            <div className="text-xs text-gray-500">
              {t('saved_searches_description')}
            </div>
          </div>
          <Link href="/editown" className="text-sm text-gray-400 hover:text-gray-200">
            {t('back_to_editown')}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6">
        <SavedSearchesWorkspace initialSearches={searches} initialDetail={initialDetail} />
      </main>
    </div>
  );
}
