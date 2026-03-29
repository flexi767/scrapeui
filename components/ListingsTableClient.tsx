'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { formatPrice, formatMileage, formatDate } from '@/lib/utils';
import type { CompetitorStats } from '@/lib/queries';

interface ListingRow {
  id: number;
  mobile_id: string;
  title: string;
  make: string;
  model: string;
  reg_month: string;
  reg_year: string;
  mileage: number;
  fuel: string | null;
  current_price: number;
  price_change: number | null;
  vat: string | null;
  kaparo: number;
  ad_status: string;
  last_edit: string;
  is_new: number;
  thumb_keys: string;
  image_meta: string;
  dealer_name: string;
  dealer_slug: string;
}

interface Props {
  rows: ListingRow[];
  competitorStats: Record<string, CompetitorStats>;
  currentParams: string;
  statuses: string[];
}

function AdStatusBadge({ status }: { status: string }) {
  if (!status || status === 'none') return <span className="text-gray-600">—</span>;
  if (status.toUpperCase() === 'TOP')
    return <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: '#1a6496' }}>TOP</span>;
  if (status.toUpperCase() === 'VIP')
    return <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: '#c0392b' }}>VIP</span>;
  return <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[11px] text-gray-300">{status}</span>;
}

function CompetitorPriceBadge({ our, stats }: { our: number; stats: CompetitorStats | undefined }) {
  if (!stats || stats.count === 0 || stats.min_price == null) {
    return <span className="text-gray-600 text-xs">—</span>;
  }
  const diff = our - (stats.avg_price ?? stats.min_price);
  const pct = Math.round((diff / (stats.avg_price ?? stats.min_price)) * 100);
  const color = pct <= -5 ? 'text-green-400' : pct >= 5 ? 'text-red-400' : 'text-yellow-300';
  const sign = pct > 0 ? '+' : '';
  return (
    <span title={`Market: ${formatPrice(stats.min_price)}–${formatPrice(stats.max_price ?? 0)} (n=${stats.count})`} className={`text-xs font-medium ${color} cursor-help`}>
      {sign}{pct}%
    </span>
  );
}

function exportCSV(rows: ListingRow[], selectedIds: Set<number>) {
  const selected = rows.filter(r => selectedIds.has(r.id));
  const headers = ['mobile_id', 'title', 'make', 'model', 'price', 'dealer', 'year', 'mileage', 'fuel', 'vat', 'ad_status'];
  const lines = [
    headers.join(','),
    ...selected.map(r => [
      r.mobile_id,
      `"${(r.title ?? '').replace(/"/g, '""')}"`,
      r.make ?? '',
      r.model ?? '',
      r.current_price ?? '',
      r.dealer_name ?? '',
      r.reg_year ?? '',
      r.mileage ?? '',
      r.fuel ?? '',
      r.vat ?? '',
      r.ad_status ?? '',
    ].join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `listings-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ListingsTableClient({ rows, competitorStats, currentParams, statuses }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const allIds = rows.map(r => r.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id));

  const toggleAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }, [allSelected, allIds]);

  const toggleOne = useCallback((id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const params = new URLSearchParams(currentParams);

  return (
    <>
      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-blue-700/50 bg-blue-950/40 px-4 py-2 text-sm">
          <span className="font-medium text-blue-200">{selected.size} selected</span>
          <button
            onClick={() => exportCSV(rows, selected)}
            className="rounded border border-blue-600 px-3 py-1 text-blue-300 hover:bg-blue-900/40 hover:text-white"
          >
            Export CSV
          </button>
          <button
            onClick={() => {
              rows.filter(r => selected.has(r.id)).forEach(r => {
                window.open(`https://www.mobile.bg/pcgi/mobile.cgi?act=4&adv=${r.mobile_id}`, '_blank');
              });
            }}
            className="rounded border border-gray-600 px-3 py-1 text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            Open in mobile.bg
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-gray-500 hover:text-gray-300"
          >
            ✕ Clear
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-left text-xs text-gray-400">
              <th className="px-2 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="cursor-pointer"
                  title="Select all"
                />
              </th>
              <th className="px-3 py-2 w-16">Photo</th>
              <th className="px-3 py-2">Make/Model</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Dealer</th>
              <th className="px-2 py-2 text-center">Ad</th>
              <th className="px-1 py-2 text-right">Price</th>
              <th className="px-2 py-2 text-center" title="vs. competitor market avg">Mkt</th>
              <th className="px-3 py-2 text-center">VAT</th>
              <th className="px-2 py-2 text-center">К</th>
              <th className="px-3 py-2 text-right">Last Edit</th>
              <th className="px-2 py-2 text-center">New</th>
              <th className="px-3 py-2 text-right">Reg</th>
              <th className="px-3 py-2 text-center">Fuel</th>
              <th className="px-3 py-2 text-right">Km</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {rows.map(row => {
              const images = (() => {
                try {
                  const meta = JSON.parse(row.image_meta || '{}');
                  const keys = JSON.parse(row.thumb_keys || '[]') as string[];
                  const cdn = meta.cdn ?? 'cdn2.focus.bg';
                  const shard = meta.shard ?? '2';
                  return keys.map(k => ({
                    thumb: `https://${cdn}/thumb/${shard}/${k}`,
                  }));
                } catch { return []; }
              })();
              const thumb = images[0]?.thumb ?? null;
              const key = `${row.make}|||${row.model}`;
              const cmptStats = competitorStats[key];
              const isSelected = selected.has(row.id);

              return (
                <tr
                  key={row.mobile_id}
                  className={`group transition-colors hover:bg-gray-800/40 ${isSelected ? 'bg-blue-950/20' : ''}`}
                >
                  {/* Checkbox */}
                  <td className="px-2 py-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(row.id)}
                      className="cursor-pointer"
                    />
                  </td>

                  {/* Thumbnail */}
                  <td className="px-3 py-1">
                    {thumb ? (
                      <div className="relative inline-block w-16">
                        <Link href={`/listings/${row.mobile_id}`} className="peer block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={thumb} alt="" className="w-16 rounded object-contain" style={{ aspectRatio: '4/3' }} />
                        </Link>
                        <div className="pointer-events-none absolute left-full top-0 z-50 ml-2 hidden w-64 peer-hover:block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={thumb} alt="" className="w-full rounded shadow-xl" style={{ aspectRatio: '4/3' }} />
                        </div>
                      </div>
                    ) : (
                      <div className="h-10 w-14 rounded bg-gray-700" />
                    )}
                  </td>

                  {/* Make + Model */}
                  <td className="px-3 py-1">
                    {row.make ? (
                      <Link href={`/listings?${new URLSearchParams([...Array.from(params.entries()).filter(([k]) => k !== 'make' && k !== 'model' && k !== 'page'), ['make', row.make]]).toString()}`}
                        className="block font-medium text-white no-underline hover:text-white hover:no-underline">
                        {row.make}
                      </Link>
                    ) : <div className="font-medium text-gray-200">—</div>}
                    {row.model ? (
                      <Link href={`/listings?${new URLSearchParams([...Array.from(params.entries()).filter(([k]) => k !== 'make' && k !== 'model' && k !== 'page'), ['make', row.make ?? ''], ['model', row.model]]).toString()}`}
                        className="block text-xs text-gray-400 no-underline hover:text-white hover:no-underline">
                        {row.model}
                      </Link>
                    ) : <div className="text-xs text-gray-400">—</div>}
                  </td>

                  {/* Title */}
                  <td className="max-w-xs px-3 py-1">
                    <Link href={`/listings/${row.mobile_id}`} className="line-clamp-2 text-white no-underline hover:text-white hover:no-underline">
                      {row.title}
                    </Link>
                  </td>

                  {/* Dealer */}
                  <td className="px-3 py-1">
                    {row.dealer_slug ? (
                      <Link href={`/listings?${new URLSearchParams([...Array.from(params.entries()).filter(([k]) => k !== 'dealer' && k !== 'page'), ['dealer', row.dealer_slug]]).toString()}`}
                        className="text-white no-underline hover:text-white hover:no-underline">
                        {row.dealer_name ?? '—'}
                      </Link>
                    ) : <span className="text-gray-300">{row.dealer_name ?? '—'}</span>}
                  </td>

                  {/* Ad Status */}
                  <td className="px-2 py-1 text-center">
                    <Link href={`/listings?${new URLSearchParams([...Array.from(params.entries()).filter(([k]) => k !== 'page'), ...(!statuses.includes(row.ad_status || 'none') ? [['status', row.ad_status || 'none'] as [string, string]] : [])]).toString()}`}>
                      <AdStatusBadge status={row.ad_status} />
                    </Link>
                  </td>

                  {/* Price */}
                  <td className="pl-1 pr-3 py-1 text-right font-semibold text-green-400">
                    <span className="flex items-center justify-end gap-1">
                      {row.price_change != null && (
                        <Link href={`/listings/${row.mobile_id}/history`} title={`${row.price_change > 0 ? '+' : ''}${row.price_change}`} className="text-sm">
                          <span className={row.price_change < 0 ? 'text-green-400' : 'text-red-400'}>
                            {row.price_change < 0 ? '↘' : '↗'}
                          </span>
                        </Link>
                      )}
                      {formatPrice(row.current_price)}
                    </span>
                  </td>

                  {/* Competitor market comparison */}
                  <td className="px-2 py-1 text-center">
                    <CompetitorPriceBadge our={row.current_price} stats={cmptStats} />
                  </td>

                  {/* VAT */}
                  <td className="px-3 py-1 text-center">
                    <Link href={`/listings?${new URLSearchParams([...Array.from(params.entries()).filter(([k]) => k !== 'page' && k !== 'vat'), ['vat', row.vat || 'null']]).toString()}`}>
                      {row.vat === 'included' ? (
                        <span className="rounded-full bg-blue-900/70 px-2 py-0.5 text-[11px] text-blue-200">има</span>
                      ) : row.vat === 'exempt' ? (
                        <span className="rounded-full bg-green-900/70 px-2 py-0.5 text-[11px] text-green-200">няма</span>
                      ) : row.vat === 'excluded' ? (
                        <span className="rounded-full bg-red-900/70 px-2 py-0.5 text-[11px] text-red-200">+ДДС</span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </Link>
                  </td>

                  {/* капаро */}
                  <td className="px-2 py-1 text-center">
                    <Link href={`/listings?${new URLSearchParams([...Array.from(params.entries()).filter(([k]) => k !== 'page' && k !== 'kaparo'), ['kaparo', row.kaparo ? 'yes' : 'no']]).toString()}`}>
                      {row.kaparo ? (
                        <span className="rounded-full bg-orange-900/70 px-2 py-0.5 text-[11px] text-orange-200">К</span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </Link>
                  </td>

                  {/* Last Edit */}
                  <td className="px-3 py-1 text-right text-xs text-gray-400">{formatDate(row.last_edit)}</td>

                  {/* New */}
                  <td className="px-2 py-1 text-center">
                    {row.is_new ? (
                      <span className="rounded-full bg-emerald-800/70 px-2 py-0.5 text-[11px] text-emerald-200">new</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>

                  {/* Reg Year */}
                  <td className="px-3 py-1 text-right">
                    {row.reg_year ? (
                      <Link href={`/listings?${new URLSearchParams([...Array.from(params.entries()), ['year', row.reg_year]]).toString()}`} className="text-gray-300 hover:text-white">
                        {row.reg_year}
                      </Link>
                    ) : <span className="text-gray-600">—</span>}
                  </td>

                  {/* Fuel */}
                  <td className="px-3 py-1 text-center">
                    {row.fuel ? (
                      <Link href={`/listings?${new URLSearchParams([...Array.from(params.entries()).filter(([k]) => k !== 'page' && k !== 'fuel'), ['fuel', row.fuel]]).toString()}`}>
                        <span className="text-xs text-gray-300 hover:text-white">{row.fuel}</span>
                      </Link>
                    ) : null}
                  </td>

                  {/* Mileage */}
                  <td className="px-3 py-1 text-right text-gray-300">{formatMileage(row.mileage)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
