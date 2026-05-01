'use client';

import { useState, useEffect, useEffectEvent } from 'react';
import { toast } from 'sonner';
import { AddDealerForm } from '@/components/dealers/AddDealerForm';
import { DealerTableRow } from '@/components/dealers/DealerTableRow';
import { type Dealer, type DealerCreateForm, type DealerEditForm, type DealerLoginResult, type TemplateName } from '@/components/dealers/types';
import { hasHttpProtocol } from '@/components/dealers/utils';

export default function DealersManager({ initialDealers, onDealersChange }: { initialDealers: Dealer[]; onDealersChange?: (dealers: Dealer[]) => void }) {
  const [dealers, setDealers] = useState<Dealer[]>(initialDealers);
  const notifyDealersChange = useEffectEvent((nextDealers: Dealer[]) => {
    onDealersChange?.(nextDealers);
  });

  useEffect(() => {
    notifyDealersChange(dealers);
  }, [dealers]);

  function updateDealers(fn: (prev: Dealer[]) => Dealer[]) {
    setDealers(prev => fn(prev));
  }
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<DealerEditForm>({
    name: '', slug: '', mobile_url: '', own: false, priority: 0,
    mobile_user: '', mobile_password: '', cars_url: '', cars_user: '', cars_password: '',
    public_enabled: false, template: 'bold' as TemplateName, public_domain: '',
  });
  const [form, setForm] = useState<DealerCreateForm>({
    name: '', slug: '', mobile_url: '', own: false, priority: 0,
    mobile_user: '', mobile_password: '', cars_url: '', cars_user: '', cars_password: '',
  });
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flashId, setFlashId] = useState<number | null>(null);
  const [loginResults, setLoginResults] = useState<Record<number, DealerLoginResult>>({});
  const [loginRunning, setLoginRunning] = useState<Set<number>>(new Set());

  async function testLogin(id: number) {
    setLoginRunning(prev => new Set([...prev, id]));
    try {
      const res = await fetch('/api/dealers/test-logins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      const data = await res.json() as Record<number, DealerLoginResult>;
      setLoginResults(prev => ({ ...prev, ...data }));
    } catch (err) {
      setLoginResults(prev => ({ ...prev, [id]: { error: (err as Error).message } }));
    } finally {
      setLoginRunning(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
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
      public_enabled: d.public_enabled === 1, template: d.template, public_domain: d.public_domain || '',
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
        public_enabled: editForm.public_enabled ? 1 : 0,
        public_domain: editForm.public_domain || null,
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
              <th className="px-4 py-2 text-center">Public</th>
              <th className="px-4 py-2 text-center w-16"></th>
              <th className="px-4 py-2 text-center w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {dealers.length === 0 && <tr><td colSpan={10} className="px-4 py-6 text-center text-gray-500">No dealers yet</td></tr>}
            {dealers.map((dealer) => (
              <DealerTableRow
                key={dealer.id}
                dealer={dealer}
                editForm={editForm}
                editing={editingId === dealer.id}
                flashActive={flashId === dealer.id}
                isLoginRunning={loginRunning.has(dealer.id)}
                loginResult={loginResults[dealer.id]}
                saving={saving}
                setEditForm={setEditForm}
                onCancelEdit={() => setEditingId(null)}
                onChangePriority={onChangePriority}
                onDelete={onDelete}
                onSaveEdit={saveEdit}
                onStartEdit={startEdit}
                onTestLogin={testLogin}
                onToggleActive={onToggleActive}
                onToggleOwn={onToggleOwn}
              />
            ))}
          </tbody>
        </table>
      </div>

      <AddDealerForm adding={adding} error={error} form={form} setForm={setForm} onSubmit={onAdd} />
    </div>
  );
}
