
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EXPENSE_CATEGORIES } from '@/components/shared/CategoryBadge';
import { LinkedCarsSelector } from '@/components/shared/LinkedCarsSelector';
import type { LabelRow } from '@/lib/queries';
import { formatDateInputValue } from '@/lib/date-format';
import { parseApiResponse } from '@/lib/utils';

export default function NewExpensePage() {
  const t = useTranslations('ui');
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency] = useState('EUR');
  const [date, setDate] = useState(formatDateInputValue());
  const [category, setCategory] = useState('other');
  const [notes, setNotes] = useState('');
  const [selectedListings, setSelectedListings] = useState<number[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<number[]>([]);
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const [labels, setLabels] = useState<LabelRow[]>([]);

  useEffect(() => {
    fetch('/api/labels').then(r => r.json()).then(setLabels);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const amountCents = Math.round(parseFloat(amount) * 100);

    try {
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
      const { id: expenseId } = await parseApiResponse<{ id: number }>(res, 'Failed to create expense');

      // Upload invoice/receipt files if provided
      if (invoiceFiles.length > 0) {
        const form = new FormData();
        for (const file of invoiceFiles) {
          form.append('files', file);
        }
        form.append('entityType', 'expense');
        form.append('entityId', String(expenseId));
        await fetch('/api/uploads', { method: 'POST', body: form });
      }

      router.push(`/expenses/${expenseId}`);
    } catch {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">{t('new_expense')}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">{t('title')}</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus placeholder={t('expense_title_placeholder')} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>{t('amount')}</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="0.00" />
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
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>{t('notes')}</Label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200"
            rows={3} placeholder={t('optional_notes_placeholder')} />
        </div>

        <div className="space-y-2">
          <Label>{t('invoice_receipt')}</Label>
          <input
            type="file"
            multiple
            onChange={(e) => setInvoiceFiles(Array.from(e.target.files ?? []))}
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="block h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30"
          />
          {invoiceFiles.length > 0 && (
            <div className="space-y-1 text-xs text-gray-400">
              {invoiceFiles.map((file) => (
                <p key={`${file.name}-${file.size}`}>{file.name}</p>
              ))}
            </div>
          )}
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
                }`}
                style={{ backgroundColor: l.color, color: '#fff' }}>
                {l.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>{saving ? t('creating') : t('create_expense')}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>{t('cancel')}</Button>
        </div>
      </form>
    </div>
  );
}
