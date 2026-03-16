'use client';

import { useState } from 'react';

interface Dealer {
  id: number;
  slug: string;
  name: string;
  mobile_url: string | null;
  own: number;
  active: number;
  mobile_user: string | null;
  mobile_password: string | null;
  cars_user: string | null;
  cars_password: string | null;
}

export default function CompetitorsManager({ initialCompetitors }: { initialCompetitors: Dealer[] }) {
  const [dealers, setDealers] = useState<Dealer[]>(initialCompetitors);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', slug: '', mobile_url: '', own: false,
    mobile_user: '', mobile_password: '', cars_user: '', cars_password: '',
  });
  const [form, setForm] = useState({
    name: '', slug: '', mobile_url: '', own: false,
    mobile_user: '', mobile_password: '', cars_user: '', cars_password: '',
  });
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  function slugify(name: string) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setAdding(true);
    try {
      const res = await fetch('/api/dealers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to add'); return; }
      setDealers(d => [...d, data]);
      setForm({ name: '', slug: '', mobile_url: '', own: false, mobile_user: '', mobile_password: '', cars_user: '', cars_password: '' });
    } finally { setAdding(false); }
  }

  async function onToggleActive(d: Dealer) {
    const newActive = d.active ? 0 : 1;
    await fetch(`/api/dealers/${d.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: newActive }),
    });
    setDealers(cs => cs.map(x => x.id === d.id ? { ...x, active: newActive } : x));
  }

  function startEdit(d: Dealer) {
    setError('');
    setEditingId(d.id);
    setEditForm({
      name: d.name, slug: d.slug, mobile_url: d.mobile_url || '', own: Boolean(d.own),
      mobile_user: d.mobile_user || '', mobile_password: d.mobile_password || '',
      cars_user: d.cars_user || '', cars_password: d.cars_password || '',
    });
  }

  async function saveEdit(id: number) {
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/dealers/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Failed to save'); return; }
      setDealers(cs => cs.map(x => x.id === id ? {
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
    setDealers(cs => cs.filter(x => x.id !== d.id));
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-700/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/60 text-xs uppercase tracking-wider text-gray-400">
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Slug</th>
              <th className="px-4 py-2 text-left">Mobile.bg URL</th>
              <th className="px-4 py-2 text-center">Own</th>
              <th className="px-4 py-2 text-center">Active</th>
              <th className="px-4 py-2 text-center">Edit</th>
              <th className="px-4 py-2 text-center">Delete</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {dealers.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">No dealers yet</td></tr>}
            {dealers.map(d => {
              const editing = editingId === d.id;
              return (
                <tr key={d.id} className="hover:bg-gray-800/40 align-top">
                  <td className="px-4 py-2 text-white">
                    {editing ? (
                      <div className="space-y-2 min-w-[180px]">
                        <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none" />
                        <label className="flex items-center gap-2 text-xs text-gray-300"><input type="checkbox" checked={editForm.own} onChange={e => setEditForm(f => ({ ...f, own: e.target.checked }))} /> own dealer</label>
                      </div>
                    ) : (
                      <div>
                        <div>{d.name}</div>
                        {Boolean(d.own) && <span className="mt-1 inline-block rounded-full bg-emerald-700 px-1.5 text-[10px] text-emerald-100">own</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-400 font-mono text-xs">
                    {editing ? (
                      <input value={editForm.slug} onChange={e => setEditForm(f => ({ ...f, slug: slugify(e.target.value) }))} className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none font-mono" />
                    ) : d.slug}
                  </td>
                  <td className="px-4 py-2">
                    {editing ? (
                      <div className="space-y-2 min-w-[260px]">
                        <input value={editForm.mobile_url} onChange={e => setEditForm(f => ({ ...f, mobile_url: e.target.value }))} placeholder="https://dealer.mobile.bg" className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none" />
                        {editForm.own && (
                          <>
                            <input value={editForm.mobile_user} onChange={e => setEditForm(f => ({ ...f, mobile_user: e.target.value }))} placeholder="mobile user" className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none" />
                            <input value={editForm.mobile_password} onChange={e => setEditForm(f => ({ ...f, mobile_password: e.target.value }))} placeholder="mobile password" className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none" />
                            <input value={editForm.cars_user} onChange={e => setEditForm(f => ({ ...f, cars_user: e.target.value }))} placeholder="cars user" className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none" />
                            <input value={editForm.cars_password} onChange={e => setEditForm(f => ({ ...f, cars_password: e.target.value }))} placeholder="cars password" className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white focus:border-blue-500 focus:outline-none" />
                          </>
                        )}
                      </div>
                    ) : (
                      <a href={d.mobile_url || '#'} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs truncate block max-w-[220px]">
                        {d.mobile_url || '—'}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center text-xs text-gray-300">{Boolean(d.own) ? 'yes' : 'no'}</td>
                  <td className="px-4 py-2 text-center">
                    <button onClick={() => onToggleActive(d)} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${d.active ? 'bg-green-800/70 text-green-200' : 'bg-gray-700 text-gray-400'}`}>{d.active ? 'on' : 'off'}</button>
                  </td>
                  <td className="px-4 py-2 text-center">
                    {editing ? (
                      <div className="flex items-center justify-center gap-2 text-xs">
                        <button onClick={() => saveEdit(d.id)} disabled={saving} className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50">save</button>
                        <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-white">cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(d)} className="text-blue-400 hover:text-blue-300 text-xs">edit</button>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center"><button onClick={() => onDelete(d)} className="text-red-500 hover:text-red-300 text-xs">✕</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form onSubmit={onAdd} className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4 space-y-3">
        <h3 className="text-sm font-medium text-gray-300">Add Dealer</h3>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: slugify(e.target.value) }))} required className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
          <input placeholder="Slug" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))} required className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none font-mono" />
          <input placeholder="https://dealer.mobile.bg" value={form.mobile_url} onChange={e => setForm(f => ({ ...f, mobile_url: e.target.value }))} required type="url" className="col-span-2 rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
          <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={form.own} onChange={e => setForm(f => ({ ...f, own: e.target.checked }))} /> own dealer</label>
          <div />
          {form.own && (
            <>
              <input placeholder="mobile user" value={form.mobile_user} onChange={e => setForm(f => ({ ...f, mobile_user: e.target.value }))} className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
              <input placeholder="mobile password" value={form.mobile_password} onChange={e => setForm(f => ({ ...f, mobile_password: e.target.value }))} className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
              <input placeholder="cars user" value={form.cars_user} onChange={e => setForm(f => ({ ...f, cars_user: e.target.value }))} className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
              <input placeholder="cars password" value={form.cars_password} onChange={e => setForm(f => ({ ...f, cars_password: e.target.value }))} className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none" />
            </>
          )}
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button type="submit" disabled={adding} className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">{adding ? 'Adding…' : '+ Add Dealer'}</button>
      </form>
    </div>
  );
}
