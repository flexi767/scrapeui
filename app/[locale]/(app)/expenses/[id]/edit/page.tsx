
'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EXPENSE_CATEGORIES } from '@/components/shared/CategoryBadge';
import { LinkedCarsSelector } from '@/components/shared/LinkedCarsSelector';

export default function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const t = useTranslations('ui');
  const { id } = use(params);
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('other');
  const [notes, setNotes] = useState('');
  const [selectedListings, setSelectedListings] = useState<number[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [labels, setLabels] = useState<{ id: number; name: string; color: string }[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/expenses/${id}`).then(r => r.json()),
      fetch('/api/labels').then(r => r.json()),
    ]).then(([exp, labelsData]) => {
      setTitle(exp.title);
      setAmount((exp.amount / 100).toFixed(2));
      setCurrency(exp.currency);
      setDate(exp.date);
      setCategory(exp.category);
      setNotes(exp.notes || '');
      setSelectedListings(exp.listings?.map((l: { id: number }) => l.id) || []);
      setSelectedLabels(exp.labels?.map((l: { id: number }) => l.id) || []);
      setLabels(labelsData);
      setLoaded(true);
    });
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const amountCents = Math.round(parseFloat(amount) * 100);

    await fetch(`/api/expenses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, amount: amountCents, currency, date, category,
        notes: notes || null,
        listingIds: selectedListings,
        labelIds: selectedLabels,
      }),
    });
    router.push(`/expenses/${id}`);
  }

  if (!loaded) return <p className="text-gray-400">{t('loading')}</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">{t('edit_expense')}</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label>{t('title')}</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>{t('amount')}</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>{t('currency')}</Label>
            <Input value={currency} readOnly className="bg-gray-900 text-gray-300" />
          </div>
          <div className="space-y-2">
            <Label>{t('date')}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t('category')}</Label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200">
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label>{t('notes')}</Label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200" rows={3} />
        </div>
        <LinkedCarsSelector selected={selectedListings} onChange={setSelectedListings} />
        <div className="space-y-2">
          <Label>{t('labels')}</Label>
          <div className="flex flex-wrap gap-2">
            {labels.map((l) => (
              <button key={l.id} type="button"
                onClick={() => {
                  if (selectedLabels.includes(l.id)) setSelectedLabels(selectedLabels.filter(x => x !== l.id));
                  else setSelectedLabels([...selectedLabels, l.id]);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedLabels.includes(l.id) ? 'ring-2 ring-white' : 'opacity-60 hover:opacity-100'
                }`} style={{ backgroundColor: l.color, color: '#fff' }}>
                {l.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>{saving ? t('saving') : t('save_changes')}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>{t('cancel')}</Button>
        </div>
      </form>
    </div>
  );
}
