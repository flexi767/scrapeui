
import Link from 'next/link';
import { ListingThumbPreview } from '@/components/ListingThumbPreview';
import { getMobileBgEditForms } from '@/lib/queries';
import { getListingThumbSrc } from '@/lib/listing-thumb';
import { formatDate } from '@/lib/utils';
import { getTranslations } from 'next-intl/server';

export default async function MobileBgEditFormsPage() {
  const t = await getTranslations('ui');
  const rows = getMobileBgEditForms(250);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('mobilebg_edit_forms_title')}</h1>
        <p className="mt-1 text-sm text-gray-400">
          {t('mobilebg_edit_forms_description')}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/60 text-xs uppercase tracking-wider text-gray-400">
              <th className="px-4 py-2 text-left">{t('col_listing')}</th>
              <th className="px-4 py-2 text-left">{t('col_dealer')}</th>
              <th className="px-4 py-2 text-left">{t('col_token')}</th>
              <th className="px-4 py-2 text-right">{t('col_captured')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-gray-500">{t('no_edit_form_snapshots_yet')}</td>
              </tr>
            ) : rows.map((row) => (
              (() => {
                const thumb = getListingThumbSrc(row);

                return (
              <tr key={row.id} className="hover:bg-gray-800/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ListingThumbPreview
                      src={thumb}
                      href={`/mobilebg/edit-forms/${row.id}`}
                      alt={row.row_title || row.mobile_id || `Snapshot ${row.id}`}
                      imageClassName="h-12 w-16 rounded-md border border-gray-700 object-cover"
                      placeholderClassName="flex h-12 w-16 items-center justify-center rounded-md border border-gray-700 bg-gray-900 text-[10px] text-gray-500"
                    />
                    <div className="min-w-0">
                      <Link href={`/mobilebg/edit-forms/${row.id}`} className="block truncate font-medium text-white hover:text-blue-300">
                        {row.row_title || row.mobile_id || `Snapshot #${row.id}`}
                      </Link>
                      <div className="mt-0.5 text-xs text-gray-400">{row.row_price_text || '—'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-300">{row.dealer_name || '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{row.listing_token || '—'}</td>
                <td className="px-4 py-3 text-right text-gray-400">{formatDate(row.created_at)}</td>
              </tr>
                );
              })()
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
