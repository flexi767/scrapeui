'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAllDealers } from '@/lib/queries';
import type { MobileBgCrawlQueueRow } from '@/lib/queries';
import { formatDate } from '@/lib/utils';

const URL_TYPES = ['dealer_homepage', 'listing_detail'];
const STATUSES = ['pending', 'in_progress', 'completed', 'failed'];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-gray-700 text-gray-300',
    in_progress: 'bg-blue-900 text-blue-200',
    completed: 'bg-green-900 text-green-200',
    failed: 'bg-red-900 text-red-200',
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors[status] || 'bg-gray-700'}`}>
      {status}
    </span>
  );
}

export default function CrawlQueuePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<MobileBgCrawlQueueRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [allDealers, setAllDealers] = useState<Array<{ slug: string; name: string }>>([]);

  const dealerFilter = searchParams.getAll('dealer');
  const urlTypeFilter = searchParams.get('url_type') ?? '';
  const statusFilter = searchParams.get('status') ?? '';
  const searchFilter = searchParams.get('search') ?? '';
  const page = parseInt(searchParams.get('page') ?? '1', 10);

  // Load dealers once
  useEffect(() => {
    const dealers = getAllDealers();
    setAllDealers(dealers);
  }, []);

  // Fetch crawl queue when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    for (const d of dealerFilter) params.append('dealer', d);
    if (urlTypeFilter) params.set('url_type', urlTypeFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (searchFilter) params.set('search', searchFilter);
    params.set('page', String(page));
    params.set('limit', '50');

    setLoading(true);
    fetch(`/api/mobilebg/crawl-queue?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setRows(data.data);
        setTotal(data.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [dealerFilter, urlTypeFilter, statusFilter, searchFilter, page]);

  const buildParams = (overrides: Record<string, string | string[]> = {}) => {
    const p = new URLSearchParams();
    if (dealerFilter.length > 0) {
      for (const d of dealerFilter) p.append('dealer', d);
    }
    if (urlTypeFilter) p.set('url_type', urlTypeFilter);
    if (statusFilter) p.set('status', statusFilter);
    if (searchFilter) p.set('search', searchFilter);

    for (const [key, val] of Object.entries(overrides)) {
      p.delete(key);
      if (Array.isArray(val)) {
        for (const v of val) p.append(key, v);
      } else if (val) {
        p.set(key, val);
      }
    }
    p.delete('page');
    return p.toString();
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-800 px-4 py-4 sticky top-0 z-10">
        <div className="mx-auto max-w-7xl">
          <h1 className="mb-4 text-2xl font-bold">Crawl Queue</h1>

          {/* Filters */}
          <div className="space-y-3">
            {/* Dealer filter */}
            <div className="flex flex-wrap gap-2">
              <label className="text-sm font-medium text-gray-300">Dealers:</label>
              {allDealers.map((dealer) => (
                <button
                  key={dealer.slug}
                  onClick={() => {
                    const newDealers = dealerFilter.includes(dealer.slug)
                      ? dealerFilter.filter((d) => d !== dealer.slug)
                      : [...dealerFilter, dealer.slug];
                    router.push(`/mobilebg/crawl-queue?${buildParams({ dealer: newDealers })}`);
                  }}
                  className={`rounded px-2 py-1 text-sm transition-colors ${
                    dealerFilter.includes(dealer.slug)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {dealer.name}
                </button>
              ))}
            </div>

            {/* URL Type, Status, Search */}
            <div className="flex flex-wrap gap-4">
              {/* URL Type */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-300">Type:</label>
                <select
                  value={urlTypeFilter}
                  onChange={(e) => router.push(`/mobilebg/crawl-queue?${buildParams({ url_type: e.target.value })}`)}
                  className="rounded bg-gray-700 px-2 py-1 text-sm text-gray-200"
                >
                  <option value="">All</option>
                  {URL_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-300">Status:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => router.push(`/mobilebg/crawl-queue?${buildParams({ status: e.target.value })}`)}
                  className="rounded bg-gray-700 px-2 py-1 text-sm text-gray-200"
                >
                  <option value="">All</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search URL or mobile ID..."
                  value={searchFilter}
                  onChange={(e) => {
                    const timer = setTimeout(() => {
                      router.push(`/mobilebg/crawl-queue?${buildParams({ search: e.target.value })}`);
                    }, 300);
                    return () => clearTimeout(timer);
                  }}
                  className="rounded bg-gray-700 px-2 py-1 text-sm text-gray-200 placeholder-gray-500"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-4">
        {loading ? (
          <div className="text-center text-gray-400 py-8">Loading...</div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-800 text-xs font-medium uppercase tracking-wider text-gray-400">
                    <th className="px-3 py-2 text-left">Dealer</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">URL / Mobile ID</th>
                    <th className="px-3 py-2 text-center">Status</th>
                    <th className="px-3 py-2 text-right">Ads</th>
                    <th className="px-3 py-2 text-right">Price</th>
                    <th className="px-3 py-2 text-right">Views</th>
                    <th className="px-3 py-2 text-left">Last Crawled</th>
                    <th className="px-3 py-2 text-left">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-gray-500">
                        No crawl queue entries found
                      </td>
                    </tr>
                  )}
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-800/30">
                      <td className="px-3 py-2 text-gray-200">
                        {row.dealer_slug ? (
                          <Link
                            href={`/mobilebg/crawl-queue?${buildParams({ dealer: [row.dealer_slug] })}`}
                            className="text-white hover:text-blue-400"
                          >
                            {row.dealer_name}
                          </Link>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400">
                        <span className="rounded bg-gray-700 px-2 py-0.5">{row.url_type}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-300 truncate max-w-md">
                        {row.mobile_id ? (
                          <Link href={`/listings/${row.mobile_id}`} className="text-blue-400 hover:text-blue-300 truncate block">
                            {row.mobile_id}
                          </Link>
                        ) : (
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 truncate block"
                          >
                            {row.url?.replace(/https?:\/\//, '')}
                          </a>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-3 py-2 text-right text-gray-300">
                        {row.listings_count ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-300">
                        {row.price ? `€${row.price}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-300">
                        {row.views ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400">
                        {row.last_crawled_at ? formatDate(row.last_crawled_at) : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-red-400 max-w-xs truncate" title={row.error || ''}>
                        {row.error || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                {page > 1 && (
                  <Link
                    href={`/mobilebg/crawl-queue?${buildParams({ page: String(page - 1) })}`}
                    className="rounded border border-gray-600 px-3 py-1.5 text-gray-300 hover:border-gray-400 hover:text-white"
                  >
                    ← Prev
                  </Link>
                )}
                <span className="text-gray-400">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages && (
                  <Link
                    href={`/mobilebg/crawl-queue?${buildParams({ page: String(page + 1) })}`}
                    className="rounded border border-gray-600 px-3 py-1.5 text-gray-300 hover:border-gray-400 hover:text-white"
                  >
                    Next →
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
