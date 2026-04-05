'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { SearchIcon } from 'lucide-react';
import { ImageWithFallback } from '@/components/ImageWithFallback';
import ListingSearchPrefillButton from '@/components/ListingSearchPrefillButton';
import { OwnListingRow } from '@/lib/queries';
import { formatPrice, formatDate, buildImageList, parseJson } from '@/lib/utils';
import { getPriceWithVat } from '@/lib/vat';

interface Props {
  initialRows: OwnListingRow[];
}

function AdStatusBadge({ status }: { status: string }) {
  if (!status || status === 'none') return null;
  if (status.toUpperCase() === 'TOP')
    return <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: '#1a6496' }}>TOP</span>;
  if (status.toUpperCase() === 'VIP')
    return <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: '#c0392b' }}>VIP</span>;
  return null;
}

function VatBadge({ vat }: { vat: string | null }) {
  if (vat === 'included')
    return <span className="rounded-full bg-blue-900/70 px-2 py-0.5 text-[11px] text-blue-200">има</span>;
  if (vat === 'exempt')
    return <span className="rounded-full bg-green-900/70 px-2 py-0.5 text-[11px] text-green-200">няма</span>;
  if (vat === 'excluded')
    return <span className="rounded-full bg-red-900/70 px-2 py-0.5 text-[11px] text-red-200">+ДДС</span>;
  return <span className="text-gray-600">—</span>;
}

function KaparoBadge({ kaparo }: { kaparo: number }) {
  if (!kaparo) return null;
  return <span className="rounded-full bg-orange-900/70 px-2 py-0.5 text-xs text-orange-200">К</span>;
}

export default function OwnListingsTable({ initialRows }: Props) {
  const [rows, setRows] = useState<OwnListingRow[]>(initialRows);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [syncingIds, setSyncingIds] = useState<Record<number, boolean>>({});
  const [editForm, setEditForm] = useState<{
    title: string;
    current_price: number;
    vat: string;
    kaparo: number;
    ad_status: string;
  }>({
    title: '',
    current_price: 0,
    vat: '',
    kaparo: 0,
    ad_status: 'none',
  });
  const [saving, setSaving] = useState(false);

  function startEdit(row: OwnListingRow) {
    if (saving) return;
    setEditForm({
      title: row.title ?? '',
      current_price: row.current_price ?? 0,
      vat: row.vat ?? '',
      kaparo: row.kaparo ?? 0,
      ad_status: row.ad_status ?? 'none',
    });
    setEditingId(row.mobile_id);
  }

  async function handleSave() {
    if (editForm.current_price < 0) {
      toast.error('Price must be non-negative');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/listings/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          current_price: editForm.current_price,
          vat: editForm.vat,
          kaparo: editForm.kaparo,
          ad_status: editForm.ad_status,
        }),
      });
      if (res.ok) {
        const updated: OwnListingRow = await res.json();
        setRows(prev => prev.map(r => r.mobile_id === updated.mobile_id ? updated : r));
        setEditingId(null);
      } else {
        const data = await res.json();
        toast.error(data.error ?? 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setEditingId(null);
  }

  async function handleSync(row: OwnListingRow) {
    setRows((prev) => prev.map((item) => item.backup_id === row.backup_id ? {
      ...item,
      last_mobile_sync_status: 'running',
      last_mobile_sync_error: null,
    } : item));
    setSyncingIds((prev) => ({ ...prev, [row.backup_id]: true }));
    try {
      const res = await fetch('/api/mobilebg/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealerSlug: row.dealer_slug, backupId: row.backup_id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data.error || 'Sync failed';
        setRows((prev) => prev.map((item) => item.backup_id === row.backup_id ? {
          ...item,
          last_mobile_sync_status: 'failed',
          last_mobile_sync_error: message,
        } : item));
        toast.error(message);
        return;
      }

      setRows((prev) => prev.map((item) => item.backup_id === row.backup_id ? {
        ...item,
        needs_sync: 0,
        last_mobile_sync_status: 'success',
        last_mobile_sync_error: null,
        last_mobile_sync_at: new Date().toISOString(),
      } : item));
      toast.success('Listing synced to mobile.bg');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sync failed';
      setRows((prev) => prev.map((item) => item.backup_id === row.backup_id ? {
        ...item,
        last_mobile_sync_status: 'failed',
        last_mobile_sync_error: message,
      } : item));
      toast.error(message);
    } finally {
      setSyncingIds((prev) => ({ ...prev, [row.backup_id]: false }));
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700/60">
      <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr className="border-b border-gray-700 bg-gray-800/60 text-xs font-medium uppercase tracking-wider text-gray-400">
            <th className="px-2 py-1.5 text-left w-28">Sync</th>
            <th className="w-16 px-3 py-1.5 text-left">Img</th>
            <th className="px-3 py-1.5 text-left">Make / Model</th>
            <th className="px-3 py-1.5 text-left">Title</th>
            <th className="px-3 py-1.5 text-left">Dealer</th>
            <th className="px-2 py-1.5 text-center w-14">Paid</th>
            <th className="pl-1 pr-3 py-1.5 text-right">Price</th>
            <th className="px-3 py-1.5 text-center">Orig #</th>
            <th className="px-3 py-1.5 text-center">Price #</th>
            <th className="px-3 py-1.5 text-right">Lead Price</th>
            <th className="px-3 py-1.5 text-center">VAT</th>
            <th className="px-2 py-1.5 text-center w-14">К</th>
            <th className="px-3 py-1.5 text-right">Last Edit</th>
            <th className="px-2 py-1.5 text-center w-12">New</th>
            <th className="px-3 py-1.5 text-right">Month</th>
            <th className="px-3 py-1.5 text-right">Year</th>
            <th className="px-3 py-1.5 text-center">Body Type</th>
            <th className="px-3 py-1.5 text-center">Fuel</th>
            <th className="px-3 py-1.5 text-right">KM</th>
            <th className="px-2 py-1.5 text-center w-16"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50">
          {rows.length === 0 && (
            <tr>
              <td colSpan={20} className="px-4 py-6 text-center text-gray-500">No listings</td>
            </tr>
          )}
          {rows.map(row => {
            const editing = editingId === row.mobile_id;

            const imageMeta = parseJson<{ cdn: string; shard: string } | null>(row.image_meta, null);
            const thumbKeys = parseJson<string[]>(row.thumb_keys, []);
            const images = buildImageList(row.mobile_id, thumbKeys, thumbKeys, imageMeta, row.images_downloaded === 1);
            const thumbSrc = images[0]?.thumb ?? null;

            const kmFormatted = row.mileage != null
              ? row.mileage.toLocaleString('en-US')
              : '—';

            return (
              <tr
                key={row.mobile_id}
                className={`align-middle transition-colors ${
                  editing
                    ? 'bg-gray-800'
                    : row.search_checked_at && row.search_original_position == null
                    ? 'bg-red-950/20 hover:bg-red-950/30'
                    : 'hover:bg-gray-800/50'
                }`}
                onClick={!editing ? () => startEdit(row) : undefined}
                style={{ cursor: editing ? 'default' : 'pointer' }}
              >
                {/* Sync */}
                <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                  <div className="flex flex-col items-start gap-1">
                    {row.needs_sync === 1 ? (
                      <button
                        onClick={() => handleSync(row)}
                        disabled={Boolean(syncingIds[row.backup_id])}
                        className="rounded border border-blue-500/60 px-2 py-1 text-[11px] font-medium text-blue-200 hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {syncingIds[row.backup_id] ? 'Syncing…' : 'Sync'}
                      </button>
                    ) : (
                      <span className="rounded border border-gray-700 px-2 py-1 text-[11px] text-gray-500">Up to date</span>
                    )}
                    <SyncStatusBadge
                      status={row.last_mobile_sync_status}
                      error={row.last_mobile_sync_error}
                    />
                  </div>
                </td>

                {/* Img */}
                <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                  <div className="flex items-start gap-2">
                    <ListingSearchPrefillButton listingId={row.id} />
                    {thumbSrc ? (
                      <div className="relative inline-block" style={{ width: 40, height: 30 }}>
                        <ImageWithFallback
                          src={thumbSrc}
                          alt={`${row.make ?? 'Listing'} ${row.model ?? ''}`.trim() || 'Listing image'}
                          className="peer rounded object-cover"
                          style={{ width: 40, height: 30 }}
                          fallbackClassName="peer rounded bg-gray-800 text-gray-400"
                          fallbackLabel="Missing"
                        />
                        <div className="pointer-events-none absolute left-full top-0 z-50 ml-2 hidden w-64 peer-hover:block">
                          <ImageWithFallback
                            src={thumbSrc}
                            alt={`${row.make ?? 'Listing'} ${row.model ?? ''}`.trim() || 'Listing image preview'}
                            className="w-full rounded shadow-xl"
                            fallbackClassName="w-full rounded bg-gray-800 text-gray-400 shadow-xl"
                            fallbackLabel="Missing"
                          />
                        </div>
                      </div>
                    ) : (
                      <div style={{ width: 40, height: 30 }} className="rounded bg-gray-700" />
                    )}
                  </div>
                </td>

                {/* Make / Model */}
                <td className="px-2 py-1.5 whitespace-nowrap">
                  <div className="font-medium text-white">{row.make ?? '—'}</div>
                  <div className="text-xs text-gray-400">{row.model ?? '—'}</div>
                </td>

                {/* Title */}
                <td className="px-2 py-1.5 max-w-[200px]">
                  {editing ? (
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                      onClick={e => e.stopPropagation()}
                      className="w-full bg-gray-700 border border-gray-500 rounded px-1 text-white text-sm"
                    />
                  ) : (
                    <span className="text-gray-200 truncate block">{row.title}</span>
                  )}
                </td>

                {/* Dealer */}
                <td className="px-2 py-1.5 text-gray-400 whitespace-nowrap">
                  {row.dealer_name}
                </td>

                {/* Ad Status */}
                <td className="px-2 py-1.5">
                  {editing ? (
                    <select
                      value={editForm.ad_status}
                      onChange={e => setEditForm(f => ({ ...f, ad_status: e.target.value }))}
                      onClick={e => e.stopPropagation()}
                      className="bg-gray-700 border border-gray-500 rounded px-1 text-white text-sm"
                    >
                      <option value="none">—</option>
                      <option value="TOP">TOP</option>
                      <option value="VIP">VIP</option>
                    </select>
                  ) : (
                    <AdStatusBadge status={row.ad_status ?? 'none'} />
                  )}
                </td>

                {/* Price */}
                <td className="px-2 py-1.5 text-right whitespace-nowrap">
                  {editing ? (
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={editForm.current_price}
                      onChange={e => {
                        const v = parseInt(e.target.value, 10);
                        setEditForm(f => ({ ...f, current_price: isNaN(v) ? 0 : v }));
                      }}
                      onClick={e => e.stopPropagation()}
                      className="w-24 bg-gray-700 border border-gray-500 rounded px-1 text-white text-sm text-right"
                    />
                  ) : (
                    <div>
                      <span className="text-green-400 font-medium">{formatPrice(row.current_price)}</span>
                      {getPriceWithVat(row.current_price, row.vat) != null && (
                        <div className="text-xs text-emerald-200/85">
                          {formatPrice(getPriceWithVat(row.current_price, row.vat))}
                        </div>
                      )}
                    </div>
                  )}
                </td>

                <td className="px-2 py-1.5 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    {row.search_original_position != null ? (
                      <span className="font-medium text-sky-200">{row.search_original_position}</span>
                    ) : row.search_checked_at ? (
                      <span className="text-xs font-medium text-red-300">not found</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                    {row.has_saved_search_profile === 1 && (
                      <span
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-500/50 bg-amber-950/40 text-amber-200"
                        title="Uses saved custom search values for search-position checks"
                      >
                        <SearchIcon className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-2 py-1.5 text-center">
                  {row.search_price_position != null ? (
                    <span className="font-medium text-emerald-200">{row.search_price_position}</span>
                  ) : (
                    <span className="text-gray-600">—</span>
                  )}
                </td>

                <td className="px-2 py-1.5 text-right whitespace-nowrap">
                  {row.search_first_result_price != null ? (
                    <span className="text-gray-300">{formatPrice(row.search_first_result_price)}</span>
                  ) : (
                    <span className="text-gray-600">—</span>
                  )}
                </td>

                {/* VAT */}
                <td className="px-2 py-1.5">
                  {editing ? (
                    <select
                      value={editForm.vat}
                      onChange={e => setEditForm(f => ({ ...f, vat: e.target.value }))}
                      onClick={e => e.stopPropagation()}
                      className="bg-gray-700 border border-gray-500 rounded px-1 text-white text-sm"
                    >
                      <option value="">—</option>
                      <option value="included">има</option>
                      <option value="exempt">няма</option>
                      <option value="excluded">+ДДС</option>
                    </select>
                  ) : (
                    <VatBadge vat={row.vat} />
                  )}
                </td>

                {/* Kaparo */}
                <td className="px-2 py-1.5">
                  {editing ? (
                    <select
                      value={editForm.kaparo}
                      onChange={e => setEditForm(f => ({ ...f, kaparo: parseInt(e.target.value, 10) }))}
                      onClick={e => e.stopPropagation()}
                      className="bg-gray-700 border border-gray-500 rounded px-1 text-white text-sm"
                    >
                      <option value={0}>—</option>
                      <option value={1}>К</option>
                    </select>
                  ) : (
                    <KaparoBadge kaparo={row.kaparo} />
                  )}
                </td>

                {/* Last Edit */}
                <td className="px-2 py-1.5 text-gray-400 whitespace-nowrap text-xs">
                  {formatDate(row.last_edit)}
                </td>

                {/* New */}
                <td className="px-2 py-1.5">
                  {row.is_new === 1 && (
                    <span className="rounded-full bg-emerald-900/70 px-2 py-0.5 text-xs text-emerald-200">new</span>
                  )}
                </td>

                {/* Month */}
                <td className="px-3 py-1.5 text-right text-gray-400 text-xs">
                  {row.reg_month ?? '—'}
                </td>

                {/* Year */}
                <td className="px-3 py-1.5 text-right text-gray-400 text-xs">
                  {row.reg_year ?? '—'}
                </td>

                {/* Category */}
                <td className="px-2 py-1.5 text-gray-400 text-xs">
                  {row.body_type ?? '—'}
                </td>

                {/* Fuel */}
                <td className="px-2 py-1.5 text-gray-400 text-xs">
                  {row.fuel ?? '—'}
                </td>

                {/* KM */}
                <td className="px-2 py-1.5 text-gray-400 text-right text-xs whitespace-nowrap">
                  {kmFormatted}
                </td>

                {/* Actions */}
                <td className="px-2 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                  {editing ? (
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        title="Save"
                        className="text-green-400 hover:text-green-300 disabled:opacity-50 text-base leading-none"
                      >
                        ✓
                      </button>
                      <button
                        onClick={handleCancel}
                        disabled={saving}
                        title="Cancel"
                        className="text-red-400 hover:text-red-300 disabled:opacity-50 text-base leading-none"
                      >
                        ✗
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(row)}
                      disabled={saving}
                      title="Edit"
                      className={`text-gray-400 hover:text-white text-base leading-none ${saving ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
                    >
                      ✎
                    </button>
                  )}
                  {!editing && row.needs_sync === 1 && (
                    <Link
                      href="/editown/sync"
                      className="ml-2 text-xs text-blue-300 hover:text-blue-200"
                    >
                      batch
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SyncStatusBadge({ status, error }: { status: string | null; error: string | null }) {
  if (status === 'running') {
    return <span className="text-[10px] text-amber-300">running</span>;
  }
  if (status === 'success') {
    return <span className="text-[10px] text-emerald-300">success</span>;
  }
  if (status === 'failed') {
    return (
      <span className="max-w-28 truncate text-[10px] text-red-300" title={error || 'failed'}>
        failed
      </span>
    );
  }
  if (status === 'pending') {
    return <span className="text-[10px] text-amber-300">pending</span>;
  }
  return null;
}
