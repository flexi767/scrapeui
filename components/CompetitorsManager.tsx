'use client';

import { useState } from 'react';

interface Competitor {
  id: number;
  slug: string;
  name: string;
  mobile_url: string;
  active: number;
}

export default function CompetitorsManager({ initialCompetitors }: { initialCompetitors: Competitor[] }) {
  const [competitors, setCompetitors] = useState<Competitor[]>(initialCompetitors);
  const [form, setForm] = useState({ name: '', slug: '', mobile_url: '' });
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  function slugify(name: string) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setAdding(true);
    try {
      const res = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to add'); return; }
      setCompetitors(c => [...c, data]);
      setForm({ name: '', slug: '', mobile_url: '' });
    } finally {
      setAdding(false);
    }
  }

  async function onToggleActive(c: Competitor) {
    const newActive = c.active ? 0 : 1;
    await fetch(`/api/competitors/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: newActive }),
    });
    setCompetitors(cs => cs.map(x => x.id === c.id ? { ...x, active: newActive } : x));
  }

  async function onDelete(c: Competitor) {
    if (!confirm(`Delete ${c.name}?`)) return;
    await fetch(`/api/competitors/${c.id}`, { method: 'DELETE' });
    setCompetitors(cs => cs.filter(x => x.id !== c.id));
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="rounded-lg border border-gray-700/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/60 text-xs uppercase tracking-wider text-gray-400">
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Slug</th>
              <th className="px-4 py-2 text-left">Mobile.bg URL</th>
              <th className="px-4 py-2 text-center">Active</th>
              <th className="px-4 py-2 text-center">Delete</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {competitors.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No competitors yet</td></tr>
            )}
            {competitors.map(c => (
              <tr key={c.id} className="hover:bg-gray-800/40">
                <td className="px-4 py-2 text-white">{c.name}</td>
                <td className="px-4 py-2 text-gray-400 font-mono text-xs">{c.slug}</td>
                <td className="px-4 py-2">
                  <a href={c.mobile_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs truncate block max-w-[200px]">
                    {c.mobile_url}
                  </a>
                </td>
                <td className="px-4 py-2 text-center">
                  <button
                    onClick={() => onToggleActive(c)}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.active ? 'bg-green-800/70 text-green-200' : 'bg-gray-700 text-gray-400'}`}
                  >
                    {c.active ? 'on' : 'off'}
                  </button>
                </td>
                <td className="px-4 py-2 text-center">
                  <button onClick={() => onDelete(c)} className="text-red-500 hover:text-red-300 text-xs">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add form */}
      <form onSubmit={onAdd} className="rounded-lg border border-gray-700/60 bg-gray-800/40 p-4 space-y-3">
        <h3 className="text-sm font-medium text-gray-300">Add Competitor</h3>
        <div className="grid grid-cols-3 gap-3">
          <input
            placeholder="Name (e.g. PeevAuto)"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: slugify(e.target.value) }))}
            required
            className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
          <input
            placeholder="Slug (e.g. peevauto)"
            value={form.slug}
            onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
            required
            className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none font-mono"
          />
          <input
            placeholder="https://dealer.mobile.bg"
            value={form.mobile_url}
            onChange={e => setForm(f => ({ ...f, mobile_url: e.target.value }))}
            required
            type="url"
            className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button
          type="submit"
          disabled={adding}
          className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {adding ? 'Adding…' : '+ Add Competitor'}
        </button>
      </form>
    </div>
  );
}
