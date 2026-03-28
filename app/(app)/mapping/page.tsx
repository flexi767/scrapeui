import Link from 'next/link';
import { getListingMappingIssues } from '@/lib/queries';
import { formatPrice, formatDate } from '@/lib/utils';

export default function MappingPage() {
  const rows = getListingMappingIssues(500);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Make/Model Mapping Diagnostics</h1>
        <p className="mt-1 text-sm text-gray-400">
          Listings with unresolved mobile.bg or cars.bg make/model IDs.
        </p>
      </div>

      <div className="rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-3 text-sm text-gray-300">
        Found <span className="font-semibold text-white">{rows.length}</span> listing(s) with incomplete mapping.
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-700/60">
        <table className="w-full min-w-[1200px] text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/60 text-xs font-medium uppercase tracking-wider text-gray-400">
              <th className="px-3 py-2 text-left">Dealer</th>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Make</th>
              <th className="px-3 py-2 text-left">Model</th>
              <th className="px-3 py-2 text-right">mobile make</th>
              <th className="px-3 py-2 text-right">mobile model</th>
              <th className="px-3 py-2 text-right">cars make</th>
              <th className="px-3 py-2 text-right">cars model</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-right">Last edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="py-16 text-center text-gray-500">
                  No mapping issues found.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-800/40">
                <td className="px-3 py-2 text-gray-300">{row.dealer_name || row.dealer_slug || '—'}</td>
                <td className="px-3 py-2 text-white">
                  <Link href={`/listings/${row.mobile_id}`} className="hover:text-blue-300">
                    {row.title}
                  </Link>
                </td>
                <td className="px-3 py-2 text-gray-300">{row.make || '—'}</td>
                <td className="px-3 py-2 text-gray-300">{row.model || '—'}</td>
                <td className={`px-3 py-2 text-right ${row.mobile_make_id ? 'text-gray-300' : 'text-red-400'}`}>{row.mobile_make_id ?? '—'}</td>
                <td className={`px-3 py-2 text-right ${row.mobile_model_id ? 'text-gray-300' : 'text-red-400'}`}>{row.mobile_model_id ?? '—'}</td>
                <td className={`px-3 py-2 text-right ${row.cars_make_id ? 'text-gray-300' : 'text-red-400'}`}>{row.cars_make_id ?? '—'}</td>
                <td className={`px-3 py-2 text-right ${row.cars_model_id ? 'text-gray-300' : 'text-red-400'}`}>{row.cars_model_id ?? '—'}</td>
                <td className="px-3 py-2 text-right text-green-400">{row.current_price ? formatPrice(row.current_price) : '—'}</td>
                <td className="px-3 py-2 text-right text-gray-400">{formatDate(row.last_edit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
