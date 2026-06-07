
import Link from 'next/link';
import CarsBgSyncRunner from '@/components/CarsBgSyncRunner';
import { getAllDealers } from '@/lib/queries';
import { getTranslations } from 'next-intl/server';

export default async function EditOwnCarsBgSyncPage() {
  const t = await getTranslations('ui');
  const dealers = getAllDealers().filter((dealer) => dealer.own === 1 && dealer.active === 1);

  return (
    <div className="min-h-screen bg-[#111827]">
      <header className="sticky top-0 z-20 border-b border-gray-700/60 bg-[#111827]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm font-medium text-gray-200">{t('carsbg_sync')}</div>
            <div className="text-xs text-gray-500">
              {t('carsbg_sync_description')}
            </div>
          </div>
          <Link href="/editown" className="text-sm text-gray-400 hover:text-gray-200">
            {t('back_to_editown')}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6">
        <CarsBgSyncRunner dealers={dealers} />
      </main>
    </div>
  );
}
