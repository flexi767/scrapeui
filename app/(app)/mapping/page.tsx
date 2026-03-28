import Link from 'next/link';
import { getMakeModelMappings } from '@/lib/queries';
import { formatDate } from '@/lib/utils';

function mappingStatus(row: {
  mobile_make_id: number | null;
  mobile_model_id: number | null;
  cars_make_id: number | null;
  cars_model_id: number | null;
}) {
  const mobileOk = row.mobile_make_id && row.mobile_model_id;
  const carsOk = row.cars_make_id && row.cars_model_id;
  if (mobileOk && carsOk) return { label: 'Resolved', className: 'bg-green-900/40 text-green-300 border-green-700/60' };
  if (mobileOk || carsOk) return { label: 'Partial', className: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/60' };
  return { label: 'Unresolved', className: 'bg-red-900/40 text-red-300 border-red-700/60' };
}

export default function MappingPage() {
  const rows = getMakeModelMappings(1000);
  const unresolvedCount = rows.filter((row) => !row.mobile_make_id || !row.mobile_model_id || !row.cars_make_id || !row.cars_model_id).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Make/Model Mapping</h1>
        <p className="mt-1 text-sm text-gray-400">
          Relationship view between mobile.bg and cars.bg make/model pairs, grouped across listings.
        </p>
      </div>

      <div className="rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-3 text-sm text-gray-300">
        Found <span className="font-semibold text-white">{rows.length}</span> mapping pair(s), with{' '}
        <span className="font-semibold text-red-300">{unresolvedCount}</span> incomplete pair(s).
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-700/60">
        <table className="w-full min-w-[1300px] text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/60 text-xs font-medium uppercase tracking-wider text-gray-400">
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Mobile make</th>
              <th className="px-3 py-2 text-left">Mobile model</th>
              <th className="px-3 py-2 text-right">mobile make id</th>
              <th className="px-3 py-2 text-right">mobile model id</th>
              <th className="px-3 py-2 text-right">cars make id</th>
              <th className="px-3 py-2 text-right">cars model id</th>
              <th className="px-3 py-2 text-right">Listings</th>
              <th className="px-3 py-2 text-left">Dealers</th>
              <th className="px-3 py-2 text-left">Example listing</th>
              <th className="px-3 py-2 text-right">Last edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="py-16 text-center text-gray-500">
                  No make/model mappings found.
                </td>
              </tr>
            )}
            {rows.map((row, idx) => {
              const status = mappingStatus(row);
              return (
                <tr key={`${row.make || 'na'}-${row.model || 'na'}-${row.mobile_make_id || 'na'}-${row.mobile_model_id || 'na'}-${idx}`} className="hover:bg-gray-800/40">
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${status.className}`}>
                      {status.label}
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
