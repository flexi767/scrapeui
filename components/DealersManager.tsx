'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface Dealer {
  id: number;
  slug: string;
  name: string;
  mobile_url: string | null;
  own: number;
  active: number;
  priority: number;
  mobile_user: string | null;
  mobile_password: string | null;
  cars_url: string | null;
  cars_user: string | null;
  cars_password: string | null;
}

export default function DealersManager({ initialDealers, onDealersChange }: { initialDealers: Dealer[]; onDealersChange?: (dealers: Dealer[]) => void }) {
  const [dealers, setDealers] = useState<Dealer[]>(initialDealers);

  useEffect(() => {
    onDealersChange?.(dealers);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealers]);

  function updateDealers(fn: (prev: Dealer[]) => Dealer[]) {
    setDealers(prev => fn(prev));
  }
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', slug: '', mobile_url: '', own: false, priority: 0,
    mobile_user: '', mobile_password: '', cars_url: '', cars_user: '', cars_password: '',
  });
  const [form, setForm] = useState({
    name: '', slug: '', mobile_url: '', own: false, priority: 0,
    mobile_user: '', mobile_password: '', cars_url: '', cars_user: '', cars_password: '',
  });
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flashId, setFlashId] = useState<number | null>(null);

  function slugify(name: string) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  function hasHttpProtocol(url: string) {
    return /^https?:\/\//i.test(url.trim());
  }

  function showValidationError(message: string) {
    setError(message);
    toast.error(message);
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!hasHttpProtocol(form.mobile_url)) {
      showValidationError('Mobile URL must start with http:// or https://');
      return;
    }
    if (form.cars_url.trim() && !hasHttpProtocol(form.cars_url)) {
      showValidationError('Cars URL must start with http:// or https://');
      return;
    }

    setAdding(true);
    try {
      const res = await fetch('/api/dealers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to add'); return; }
      updateDealers(d => [...d, data]);
      setForm({ name: '', slug: '', mobile_url: '', own: false, priority: 0, mobile_user: '', mobile_password: '', cars_url: '', cars_user: '', cars_password: '' });
    } finally { setAdding(false); }
  }

  async function onToggleActive(d: Dealer) {
    const newActive = d.active ? 0 : 1;
    await fetch(`/api/dealers/${d.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: newActive }),
    });
    updateDealers(cs => cs.map(x => x.id === d.id ? { ...x, active: newActive } : x));
  }

  async function onToggleOwn(d: Dealer) {
    const newOwn = d.own ? 0 : 1;
    await fetch(`/api/dealers/${d.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ own: newOwn }),
    });
    updateDealers(cs => cs.map(x => x.id === d.id ? { ...x, own: newOwn } : x));
    if (newOwn === 1) startEdit({ ...d, own: newOwn });
    else if (editingId === d.id) setEditingId(null);
  }

  async function onChangePriority(d: Dealer, delta: number) {
    const newPriority = (d.priority || 0) + delta;
    await fetch(`/api/dealers/${d.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: newPriority }),
    });
    updateDealers(cs => cs.map(x => x.id === d.id ? { ...x, priority: newPriority } : x).sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.name.localeCompare(b.name)));
    setFlashId(d.id);
    setTimeout(() => setFlashId(null), 600);
  }

  function startEdit(d: Dealer) {
    setError('');
    setEditingId(d.id);
    setEditForm({
      name: d.name, slug: d.slug, mobile_url: d.mobile_url || '', own: Boolean(d.own), priority: d.priority || 0,
      mobile_user: d.mobile_user || '', mobile_password: d.mobile_password || '',
      cars_url: d.cars_url || '', cars_user: d.cars_user || '', cars_password: d.cars_password || '',
    });
  }

  async function saveEdit(id: number) {
    setError('');

    if (!hasHttpProtocol(editForm.mobile_url)) {
      showValidationError('Mobile URL must start with http:// or https://');
      return;
    }
    if (editForm.cars_url.trim() && !hasHttpProtocol(editForm.cars_url)) {
      showValidationError('Cars URL must start with http:// or https://');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/dealers/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Failed to save'); return; }
      updateDealers(cs => cs.map(x => x.id === id ? {
        ...x,
        ...editForm,
        own: editForm.own ? 1 : 0,
      } : x));
      setEditingId(null);
    } finally { setSaving(false); }
  }

  async function onDelete(d: Dealer) {
    if (!confirm(`Delete ${d.name}?`)) return;
    await fetch(`/api/dealers/${d.id}`, { method: 'DELETE' });
    updateDealers(cs => cs.filter(x => x.id !== d.id));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-700/60 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/60 text-xs uppercase tracking-wider text-gray-400">
              <th className="px-4 py-2 text-left w-40">Name</th>
              <th className="px-4 py-2 text-left">Slug</th>
              <th className="px-4 py-2 text-left">Mobile.bg URL</th>
              <th className="px-4 py-2 text-left">Cars.bg URL</th>
              <th className="px-4 py-2 text-center">Own</th>
              <th className="px-4 py-2 text-center">Priority</th>
              <th className="px-4 py-2 text-center">Active</th>
              <th className="px-4 py-2 text-center w-16"></th>
              <th className="px-4 py-2 text-center w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {dealers.length === 0 && <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-500">No dealers yet</td></tr>}
            {dealers.map(d => {
              const editing = editingId === d.id;
              return (
                <tr key={d.id} className={`align-top transition-colors duration-500 ${flashId === d.id ? 'bg-blue-900/40' : 'hover:bg-gray-800/40'}`}>
                  <td className="px-4 py-2 text-white">
                    {editing ? (
                      <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none" />
                    ) : (
                      <button onClick={() => startEdit(d)} className="text-left text-white hover:text-blue-300">{d.name}</button>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-400 font-mono text-xs">
                    {editing ? (
                      <input value={editForm.slug} onChange={e => setEditForm(f => ({ ...f, slug: slugify(e.target.value) }))} className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none font-mono" />
                    ) : (
                      <button onClick={() => startEdit(d)} className="text-left font-mono text-xs text-gray-400 hover:text-blue-300">{d.slug}</button>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {editing ? (
                      <div className="space-y-2">
                        <input value={editForm.mobile_url} onChange={e => setEditForm(f => ({ ...f, mobile_url: e.target.value }))} placeholder="https://dealer.mobile.bg" className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none" />
                        {editForm.own && (
                          <>
                            <input value={editForm.mobile_user} onChange={e => setEditForm(f => ({ ...f, mobile_user: e.target.value }))} placeholder="mobile user" className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none" />
                            <input value={editForm.mobile_password} onChange={e => setEditForm(f => ({ ...f, mobile_password: e.target.value }))} placeholder="mobile password" className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none" />
                          </>
                        )}
                      </div>
                    ) : d.mobile_url ? (
                      <a href={d.mobile_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs truncate block max-w-[220px]">
                        {d.mobile_url}
                      </a>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    {editing ? (
                      <div className="space-y-2">
                        <input value={editForm.cars_url} onChange={e => setEditForm(f => ({ ...f, cars_url: e.target.value }))} placeholder="https://www.cars.bg/company/dealer" className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none" />
                        {editForm.own && (
                          <>
                            <input value={editForm.cars_user} onChange={e => setEditForm(f => ({ ...f, cars_user: e.target.value }))} placeholder="cars user" className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none" />
                            <input value={editForm.cars_password} onChange={e => setEditForm(f => ({ ...f, cars_password: e.target.value }))} placeholder="cars password" className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none" />
                          </>
                        )}
                      </div>
                    ) : d.cars_url ? (
                      <a href={d.cars_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs truncate block max-w-[220px]">
                        {d.cars_url}
                      </a>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button onClick={() => onToggleOwn(d)} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${d.own ? 'bg-emerald-800/70 text-emerald-200' : 'bg-gray-700 text-gray-400'}`}>{d.own ? 'yes' : 'no'}</button>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => onChangePriority(d, -1)} className="rounded px-1.5 py-0.5 text-xs text-gray-400 hover:text-white hover:bg-gray-700">−</button>
                      <span className="w-6 text-center text-sm text-gray-300">{d.priority || 0}</span>
                      <button onClick={() => onChangePriority(d, 1)} className="rounded px-1.5 py-0.5 text-xs text-gray-400 hover:text-white hover:bg-gray-700">+</button>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button onClick={() => onToggleActive(d)} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${d.active ? 'bg-green-800/70 text-green-200' : 'bg-gray-700 text-gray-400'}`}>{d.active ? 'on' : 'off'}</button>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* Save (checkmark) — visible only when editing */}
                      <button onClick={() => saveEdit(d.id)} disabled={saving} title="Save" className={`text-emerald-400 hover:text-emerald-300 disabled:opacity-50 ${editing ? '' : 'invisible'}`}>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      {/* Pencil / Cancel — swaps but always takes space */}
                      {editing ? (
                        <button onClick={() => setEditingId(null)} title="Cancel" className="text-gray-400 hover:text-white">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      ) : (
                        <button onClick={() => startEdit(d)} title="Edit" className="text-gray-400 hover:text-blue-400">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H8v-2.414a2 2 0 01.586-1.414z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button onClick={() => onDelete(d)} title="Delete" className="text-gray-600 hover:text-red-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 011-1h4a1 1 0 011 1m-7 0H5m14 0h-2" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form onSubmit={onAdd} className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4 space-y-3">
        <h3 className="text-sm font-medium text-gray-300">Add</h3>
        <div className="grid grid-cols-4 items-start gap-3">
          <input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: slugify(e.target.value) }))} required className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none min-w-0" />
          <input placeholder="Slug" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))} required className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none font-mono" />
          <input placeholder="https://dealer.mobile.bg" value={form.mobile_url} onChange={e => setForm(f => ({ ...f, mobile_url: e.target.value }))} required type="url" className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none min-w-0" />
          <input placeholder="https://www.cars.bg/company/dealer" value={form.cars_url} onChange={e => setForm(f => ({ ...f, cars_url: e.target.value }))} type="url" className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none min-w-0" />
          <div className="flex items-start justify-between gap-3">
            <button type="submit" disabled={adding} className="justify-self-start rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">{adding ? 'Adding…' : '+ Add'}</button>
            <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={form.own} onChange={e => setForm(f => ({ ...f, own: e.target.checked }))} /> own dealer</label>
          </div>
          <div className="flex items-start gap-2">
            <label className="text-sm text-gray-400">Priority:</label>
            <input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} className="w-20 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white text-center focus:border-blue-500 focus:outline-none" />
          </div>
          {form.own && (
            <>
              <div className="flex flex-col gap-2">
                <input placeholder="mobile user" value={form.mobile_user} onChange={e => setForm(f => ({ ...f, mobile_user: e.target.value }))} className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none min-w-0" />
                <input placeholder="mobile password" value={form.mobile_password} onChange={e => setForm(f => ({ ...f, mobile_password: e.target.value }))} className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none min-w-0" />
              </div>
              <div className="flex flex-col gap-2">
                <input placeholder="cars user" value={form.cars_user} onChange={e => setForm(f => ({ ...f, cars_user: e.target.value }))} className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none min-w-0" />
                <input placeholder="cars password" value={form.cars_password} onChange={e => setForm(f => ({ ...f, cars_password: e.target.value }))} className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none min-w-0" />
              </div>
            </>
          )}
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
      </form>
    </div>
  );
}
