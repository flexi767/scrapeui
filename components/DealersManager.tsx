'use client';

import { useState, useEffect, useEffectEvent } from 'react';
import { toast } from 'sonner';
import { AddDealerForm } from '@/components/dealers/AddDealerForm';
import { DealersTable } from '@/components/dealers/DealersTable';
import { createDealer, deleteDealer, patchDealer, testDealerLogins } from '@/components/dealers/api';
import { createEmptyDealerEditForm, createEmptyDealerForm, dealerToEditForm, validateDealerUrls } from '@/components/dealers/formUtils';
import { type Dealer, type DealerCreateForm, type DealerEditForm, type DealerLoginResult } from '@/components/dealers/types';

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
  const [editForm, setEditForm] = useState<DealerEditForm>(() => createEmptyDealerEditForm());
  const [form, setForm] = useState<DealerCreateForm>(() => createEmptyDealerForm());
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flashId, setFlashId] = useState<number | null>(null);
  const [loginResults, setLoginResults] = useState<Record<number, DealerLoginResult>>({});
  const [loginRunning, setLoginRunning] = useState<Set<number>>(new Set());

  async function testLogin(id: number) {
    setLoginRunning(prev => new Set([...prev, id]));
    try {
      const data = await testDealerLogins(id);
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

    const validationError = validateDealerUrls(form);
    if (validationError) {
      showValidationError(validationError);
      return;
    }

    setAdding(true);
    try {
      const result = await createDealer(form);
      if (!result.ok) { setError(result.error); return; }
      updateDealers(d => [...d, result.data]);
      setForm(createEmptyDealerForm());
    } finally { setAdding(false); }
  }

  async function onToggleActive(d: Dealer) {
    const newActive = d.active ? 0 : 1;
    await patchDealer(d.id, { active: newActive });
    updateDealers(cs => cs.map(x => x.id === d.id ? { ...x, active: newActive } : x));
  }

  async function onToggleOwn(d: Dealer) {
    const newOwn = d.own ? 0 : 1;
    await patchDealer(d.id, { own: newOwn });
    updateDealers(cs => cs.map(x => x.id === d.id ? { ...x, own: newOwn } : x));
    if (newOwn === 1) startEdit({ ...d, own: newOwn });
    else if (editingId === d.id) setEditingId(null);
  }

  async function onChangePriority(d: Dealer, delta: number) {
    const newPriority = (d.priority || 0) + delta;
    await patchDealer(d.id, { priority: newPriority });
    updateDealers(cs => cs.map(x => x.id === d.id ? { ...x, priority: newPriority } : x).sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.name.localeCompare(b.name)));
    setFlashId(d.id);
    setTimeout(() => setFlashId(null), 600);
  }

  function startEdit(d: Dealer) {
    setError('');
    setEditingId(d.id);
    setEditForm(dealerToEditForm(d));
  }

  async function saveEdit(id: number) {
    setError('');

    const validationError = validateDealerUrls(editForm);
    if (validationError) {
      showValidationError(validationError);
      return;
    }

    setSaving(true);
    try {
      const result = await patchDealer(id, editForm);
      if (!result.ok) { setError(result.error); return; }
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
    await deleteDealer(d.id);
    updateDealers(cs => cs.filter(x => x.id !== d.id));
  }

  return (
    <div className="space-y-4">
      <DealersTable
        dealers={dealers}
        editingId={editingId}
        editForm={editForm}
        flashId={flashId}
        loginResults={loginResults}
        loginRunning={loginRunning}
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

      <AddDealerForm adding={adding} error={error} form={form} setForm={setForm} onSubmit={onAdd} />
    </div>
  );
}
