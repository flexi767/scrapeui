'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EXPENSE_CATEGORIES } from '@/components/shared/CategoryBadge';
import { LinkedCarsSelector } from '@/components/shared/LinkedCarsSelector';

interface LabelOption { id: number; name: string; color: string; }

export default function NewExpensePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('BGN');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('other');
  const [notes, setNotes] = useState('');
  const [selectedListings, setSelectedListings] = useState<number[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<number[]>([]);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const [labels, setLabels] = useState<LabelOption[]>([]);

  useEffect(() => {
    fetch('/api/labels').then(r => r.json()).then(setLabels);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const amountCents = Math.round(parseFloat(amount) * 100);

    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, amount: amountCents, currency, date, category,
        notes: notes || null,
        listingIds: selectedListings,
        labelIds: selectedLabels,
      }),
    });

    if (res.ok) {
      const { id: expenseId } = await res.json();

      // Upload invoice if provided
      if (invoiceFile) {
        const form = new FormData();
        form.append('file', invoiceFile);
        form.append('entityType', 'expense');
        form.append('entityId', String(expenseId));
        await fetch('/api/uploads', { method: 'POST', body: form });
      }

      router.push(`/expenses/${expenseId}`);
    } else {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">New Expense</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus placeholder="Expense title" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}
              className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200">
              <option value="BGN">BGN</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Category</Label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200">
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Notes</Label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200"
            rows={3} placeholder="Optional notes..." />
        </div>

        <div className="space-y-2">
          <Label>Invoice / Receipt</Label>
          <Input type="file" onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
            accept=".pdf,.jpg,.jpeg,.png,.webp" />
          {invoiceFile && <p className="text-xs text-gray-400">{invoiceFile.name}</p>}
        </div>

        <LinkedCarsSelector selected={selectedListings} onChange={setSelectedListings} />

        <div className="space-y-2">
          <Label>Labels</Label>
          <div className="flex flex-wrap gap-2">
            {labels.map((l) => (
              <button key={l.id} type="button"
                onClick={() => {
                  if (selectedLabels.includes(l.id)) setSelectedLabels(selectedLabels.filter(x => x !== l.id));
                  else setSelectedLabels([...selectedLabels, l.id]);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedLabels.includes(l.id) ? 'ring-2 ring-white' : 'opacity-60 hover:opacity-100'
                }`}
                style={{ backgroundColor: l.color, color: '#fff' }}>
                {l.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Expense'}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
