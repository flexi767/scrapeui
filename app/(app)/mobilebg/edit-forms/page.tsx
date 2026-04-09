import Link from 'next/link';
import { ImageWithFallback } from '@/components/ImageWithFallback';
import { getMobileBgEditForms } from '@/lib/queries';
import { buildImageList, formatDate, getThumbProxyUrl, parseJson } from '@/lib/utils';

export default function MobileBgEditFormsPage() {
  const rows = getMobileBgEditForms(250);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mobile.bg Edit Forms</h1>
        <p className="mt-1 text-sm text-gray-400">
          Snapshots of the live dealer edit form, stored in the database for comparison and repost workflows.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/60 text-xs uppercase tracking-wider text-gray-400">
              <th className="px-4 py-2 text-left">Listing</th>
              <th className="px-4 py-2 text-left">Dealer</th>
              <th className="px-4 py-2 text-left">Token</th>
              <th className="px-4 py-2 text-right">Captured</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-gray-500">No edit form snapshots yet.</td>
              </tr>
            ) : rows.map((row) => (
              (() => {
                const imageMeta = parseJson<{ cdn: string; shard: string } | null>(row.image_meta, null);
                const thumbKeys = parseJson<string[]>(row.thumb_keys, []);
                const fullKeys = parseJson<string[]>(row.full_keys, []);
                const images = buildImageList(
                  row.mobile_id || '',
                  fullKeys.length ? fullKeys : thumbKeys,
                  thumbKeys,
                  imageMeta,
                  row.images_downloaded === 1,
                );
                const thumb = images[0]?.thumb ?? (row.mobile_id && row.thumb_saved === 1 ? getThumbProxyUrl(row.mobile_id, null) : null);

                return (
              <tr key={row.id} className="hover:bg-gray-800/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/mobilebg/edit-forms/${row.id}`} className="block shrink-0">
                      <div className="overflow-hidden rounded-md border border-gray-700 bg-gray-900">
                        {thumb ? (
                          <ImageWithFallback
                            src={thumb}
                            alt={row.row_title || row.mobile_id || `Snapshot ${row.id}`}
                            className="h-12 w-16 object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-16 items-center justify-center text-[10px] text-gray-500">
                            No image
                          </div>
                        )}
                      </div>
                    </Link>
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
