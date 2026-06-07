
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import ReparseRunner from '@/components/ReparseRunner';
import MobileBgMakeModelSyncRunner from '@/components/MobileBgMakeModelSyncRunner';
import { raw } from '@/db/client';
import { getMakeModelMappings } from '@/lib/queries';
import { formatDate } from '@/lib/utils';

interface DealerRow {
  id: number;
  slug: string;
  name: string;
}

function getDealers(): DealerRow[] {
  return raw.prepare(`
    SELECT id, slug, name
    FROM dealers
    WHERE active = 1
    ORDER BY priority DESC, name
  `).all() as DealerRow[];
}

function mappingStatus(row: {
  mobile_make_id: number | null;
  mobile_model_id: number | null;
  cars_make_id: number | null;
  cars_model_id: number | null;
}) {
  const mobileOk = row.mobile_make_id && row.mobile_model_id;
  const carsOk = row.cars_make_id && row.cars_model_id;
  if (mobileOk && carsOk) return { labelKey: 'resolved' as const, className: 'bg-green-900/40 text-green-300 border-green-700/60' };
  if (mobileOk || carsOk) return { labelKey: 'partial' as const, className: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/60' };
  return { labelKey: 'unresolved' as const, className: 'bg-red-900/40 text-red-300 border-red-700/60' };
}

export default async function MappingPage() {
  const t = await getTranslations('ui');
  const dealers = getDealers();
  const rows = getMakeModelMappings(1000);
  const unresolvedCount = rows.filter((row) => !row.mobile_make_id || !row.mobile_model_id || !row.cars_make_id || !row.cars_model_id).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('make_model_mapping')}</h1>
        <p className="mt-1 text-sm text-gray-400">
          {t('make_model_mapping_description')}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-lg border border-gray-700/60 bg-gray-900/40 p-5">
          <h2 className="mb-2 text-lg font-semibold text-white">{t('sync_mobilebg_make_model_reference')}</h2>
          <p className="mb-4 text-sm text-gray-400">
            {t('sync_mobilebg_make_model_reference_description')}
          </p>
          <MobileBgMakeModelSyncRunner />
        </section>

        <section className="rounded-lg border border-gray-700/60 bg-gray-900/40 p-5">
          <h2 className="mb-4 text-lg font-semibold text-white">{t('reparse_make_model')}</h2>
          <ReparseRunner dealers={dealers} />
        </section>
      </div>

      <section className="rounded-lg border border-gray-700/60 bg-gray-900/40 p-5">
        <h2 className="text-lg font-semibold text-white">{t('form_config')}</h2>
        <p className="mt-2 text-sm text-gray-400">
          {t('form_config_description')}
        </p>
        <div className="mt-4">
          <Link
            href="/mobilebg/edit-forms"
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            {t('open_edit_form_config')}
          </Link>
        </div>
      </section>

      <div className="rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-3 text-sm text-gray-300">
        {t('found')} <span className="font-semibold text-white">{rows.length}</span> {t('mapping_pairs_with')}{' '}
        <span className="font-semibold text-red-300">{unresolvedCount}</span> {t('incomplete_pairs')}.
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-700/60">
        <table className="w-full min-w-[1300px] text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/60 text-xs font-medium uppercase tracking-wider text-gray-400">
              <th className="px-3 py-2 text-left">{t('status')}</th>
              <th className="px-3 py-2 text-left">{t('mobile_make')}</th>
              <th className="px-3 py-2 text-left">{t('mobile_model')}</th>
              <th className="px-3 py-2 text-right">{t('mobile_make_id')}</th>
              <th className="px-3 py-2 text-right">{t('mobile_model_id')}</th>
              <th className="px-3 py-2 text-right">{t('cars_make_id')}</th>
              <th className="px-3 py-2 text-right">{t('cars_model_id')}</th>
              <th className="px-3 py-2 text-right">{t('listings')}</th>
              <th className="px-3 py-2 text-left">{t('dealers')}</th>
              <th className="px-3 py-2 text-left">{t('example_listing')}</th>
              <th className="px-3 py-2 text-right">{t('last_edit')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="py-16 text-center text-gray-500">
                  {t('no_make_model_mappings_found')}
                </td>
              </tr>
            )}
            {rows.map((row, idx) => {
              const status = mappingStatus(row);
              return (
                <tr key={`${row.make || 'na'}-${row.model || 'na'}-${row.mobile_make_id || 'na'}-${row.mobile_model_id || 'na'}-${idx}`} className="hover:bg-gray-800/40">
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${status.className}`}>
                      {t(status.labelKey)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-200">{row.make || '—'}</td>
                  <td className="px-3 py-2 text-gray-200">{row.model || '—'}</td>
                  <td className={`px-3 py-2 text-right ${row.mobile_make_id ? 'text-gray-300' : 'text-red-400'}`}>{row.mobile_make_id ?? '—'}</td>
                  <td className={`px-3 py-2 text-right ${row.mobile_model_id ? 'text-gray-300' : 'text-red-400'}`}>{row.mobile_model_id ?? '—'}</td>
                  <td className={`px-3 py-2 text-right ${row.cars_make_id ? 'text-gray-300' : 'text-red-400'}`}>{row.cars_make_id ?? '—'}</td>
                  <td className={`px-3 py-2 text-right ${row.cars_model_id ? 'text-gray-300' : 'text-red-400'}`}>{row.cars_model_id ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-white">{row.listing_count}</td>
                  <td className="px-3 py-2 text-gray-400">{row.dealer_names || '—'}</td>
                  <td className="px-3 py-2 text-white">
                    {row.sample_mobile_id ? (
                      <Link href={`/listings/${row.sample_mobile_id}`} className="hover:text-blue-300">
                        {row.sample_title || row.sample_mobile_id}
                      </Link>
                    ) : (
                      row.sample_title || '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-400">{formatDate(row.latest_last_edit)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
