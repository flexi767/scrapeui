import Link from 'next/link';
import { getMobileBgBackups } from '@/lib/queries';
import { formatDate, formatPrice } from '@/lib/utils';

export default function MobileBgBackupsPage() {
  const backups = getMobileBgBackups(250);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mobile.bg Backups</h1>
        <p className="mt-1 text-sm text-gray-400">
          Backed up listing artifacts stored in the database, with images still stored locally.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/60 text-xs uppercase tracking-wider text-gray-400">
              <th className="px-4 py-2 text-left">Listing</th>
              <th className="px-4 py-2 text-left">Dealer</th>
              <th className="px-4 py-2 text-right">Price</th>
              <th className="px-4 py-2 text-right">Images</th>
              <th className="px-4 py-2 text-right">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {backups.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-gray-500">No mobile.bg backups yet.</td>
              </tr>
            ) : backups.map((backup) => (
              <tr key={backup.id} className="hover:bg-gray-800/40">
                <td className="px-4 py-3">
                  <Link href={`/mobilebg/backups/${backup.id}`} className="block font-medium text-white hover:text-blue-300">
                    {backup.make || '—'} {backup.model || ''}
                  </Link>
                  <div className="mt-0.5 text-xs text-gray-400">{backup.title || backup.source_title || backup.mobile_id || '—'}</div>
                </td>
                <td className="px-4 py-3 text-gray-300">{backup.dealer_name || '—'}</td>
                <td className="px-4 py-3 text-right font-medium text-green-400">{formatPrice(backup.price_amount)}</td>
                <td className="px-4 py-3 text-right text-gray-300">{backup.image_count}</td>
                <td className="px-4 py-3 text-right text-gray-400">{formatDate(backup.updated_at || backup.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
