'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { OwnListingRow } from '@/lib/queries';
import { formatPrice, formatDate, buildImageList, parseJson } from '@/lib/utils';

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
  if (!vat) return null;
  if (vat === 'included')
    return <span className="rounded-full bg-blue-900/70 px-2 py-0.5 text-xs text-blue-200">included</span>;
  if (vat === 'exempt')
    return <span className="rounded-full bg-green-900/70 px-2 py-0.5 text-xs text-green-200">exempt</span>;
  if (vat === 'excluded')
    return <span className="rounded-full bg-red-900/70 px-2 py-0.5 text-xs text-red-200">excluded</span>;
  return null;
}

function KaparoBadge({ kaparo }: { kaparo: number }) {
  if (!kaparo) return null;
  return <span className="rounded-full bg-orange-900/70 px-2 py-0.5 text-xs text-orange-200">К</span>;
}

export default function OwnListingsTable({ initialRows }: Props) {
  const [rows, setRows] = useState<OwnListingRow[]>(initialRows);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700/60">
      <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr className="border-b border-gray-700 bg-gray-800/60 text-xs text-gray-400 uppercase tracking-wide">
            <th className="px-2 py-2 text-left w-6">Sync</th>
            <th className="px-2 py-2 text-left w-12">Img</th>
            <th className="px-2 py-2 text-left">Make/Model</th>
            <th className="px-2 py-2 text-left">Title</th>
            <th className="px-2 py-2 text-left">Dealer</th>
            <th className="px-2 py-2 text-left">Status</th>
            <th className="px-2 py-2 text-right">Price</th>
            <th className="px-2 py-2 text-left">VAT</th>
            <th className="px-2 py-2 text-left">Kap</th>
            <th className="px-2 py-2 text-left">Last Edit</th>
            <th className="px-2 py-2 text-left">New</th>
            <th className="px-2 py-2 text-left">Mo/Yr</th>
            <th className="px-2 py-2 text-left">Fuel</th>
            <th className="px-2 py-2 text-right">KM</th>
            <th className="px-2 py-2 text-center w-16"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50">
          {rows.length === 0 && (
            <tr>
              <td colSpan={15} className="px-4 py-6 text-center text-gray-500">No listings</td>
            </tr>
          )}
          {rows.map(row => {
            const editing = editingId === row.mobile_id;

            const imageMeta = parseJson<{ cdn: string; shard: string } | null>(row.image_meta, null);
            const thumbKeys = parseJson<string[]>(row.thumb_keys, []);
            const images = buildImageList(row.mobile_id, thumbKeys, thumbKeys, imageMeta, row.images_downloaded === 1);
            const thumbSrc = images[0]?.thumb ?? null;

            const regDisplay = row.reg_month
              ? `${row.reg_month}/${row.reg_year}`
              : row.reg_year ?? '—';

            const kmFormatted = row.mileage != null
              ? row.mileage.toLocaleString('en-US')
              : '—';

            return (
              <tr
                key={row.mobile_id}
                className={`align-middle transition-colors ${editing ? 'bg-gray-800' : 'hover:bg-gray-800/50'}`}
                onClick={!editing ? () => startEdit(row) : undefined}
                style={{ cursor: editing ? 'default' : 'pointer' }}
              >
                {/* Sync */}
                <td className="px-2 py-1.5 text-center">
                  {row.needs_sync === 1 && <span className="text-amber-400 text-xs">●</span>}
                </td>

                {/* Img */}
                <td className="px-2 py-1.5">
                  {thumbSrc ? (
                    <img src={thumbSrc} alt="" width={40} height={30} className="rounded object-cover" style={{ width: 40, height: 30 }} />
                  ) : (
                    <div style={{ width: 40, height: 30 }} className="rounded bg-gray-700" />
                  )}
                </td>

                {/* Make / Model */}
                <td className="px-2 py-1.5 text-gray-300 whitespace-nowrap">
                  {row.make} {row.model}
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
                    <span className="text-green-400 font-medium">{formatPrice(row.current_price)}</span>
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
                      <option value="included">included</option>
                      <option value="exempt">exempt</option>
                      <option value="excluded">excluded</option>
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

                {/* Month/Year */}
                <td className="px-2 py-1.5 text-gray-400 whitespace-nowrap text-xs">
                  {regDisplay}
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
