'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CategoryBadge } from '@/components/shared/CategoryBadge';

interface ExpenseDetail {
  id: number;
  title: string;
  amount: number;
  currency: string;
  date: string;
  category: string;
  notes: string | null;
  creator_name: string | null;
  created_at: string;
  listings: { id: number; mobile_id: string; title: string; make: string; model: string }[];
  tasks: { id: number; title: string; status: string }[];
  labels: { id: number; name: string; color: string }[];
  uploads: { id: number; filename: string; stored_name: string; mime_type: string }[];
}

export default function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [expense, setExpense] = useState<ExpenseDetail | null>(null);

  useEffect(() => {
    fetch(`/api/expenses/${id}`).then(r => r.json()).then(setExpense);
  }, [id]);

  async function deleteExpense() {
    if (!confirm('Delete this expense?')) return;
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    router.push('/expenses');
  }

  if (!expense) return <p className="text-gray-400">Loading...</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <CategoryBadge category={expense.category} />
        </div>
        <h1 className="text-2xl font-bold">{expense.title}</h1>
        <div className="mt-1 flex items-center gap-4 text-sm text-gray-400">
          <span>{expense.date}</span>
          <span>By {expense.creator_name}</span>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-gray-700 bg-gray-800 p-6">
        <p className="text-3xl font-bold text-gray-100">
          {(expense.amount / 100).toFixed(2)} {expense.currency}
        </p>
      </div>

      {expense.notes && (
        <div className="mb-6 rounded-lg border border-gray-700 bg-gray-800 p-4">
          <h3 className="mb-1 text-sm font-medium text-gray-400">Notes</h3>
          <p className="text-sm text-gray-200 whitespace-pre-wrap">{expense.notes}</p>
        </div>
      )}

      {expense.listings.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-1 text-sm font-medium text-gray-400">Linked Cars</h3>
          <div className="flex flex-wrap gap-2">
            {expense.listings.map((l) => (
              <Link key={l.id} href={`/listings/${l.mobile_id}`}
                className="rounded-md border border-gray-600 px-2 py-1 text-xs hover:border-gray-400">
                {l.make} {l.model} — {l.title || l.mobile_id}
              </Link>
            ))}
          </div>
        </div>
      )}

      {expense.tasks.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-1 text-sm font-medium text-gray-400">Linked Tasks</h3>
          <div className="flex flex-wrap gap-2">
            {expense.tasks.map((t) => (
              <Link key={t.id} href={`/tasks/${t.id}`}
                className="rounded-md border border-gray-600 px-2 py-1 text-xs hover:border-gray-400">
                {t.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      {expense.labels.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1">
          {expense.labels.map((l) => (
            <span key={l.id} className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: l.color, color: '#fff' }}>
              {l.name}
            </span>
          ))}
        </div>
      )}

      {expense.uploads.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-medium text-gray-400">Invoices / Receipts</h3>
          <div className="space-y-1">
            {expense.uploads.map((u) => (
              <a key={u.id} href={`/api/uploads/${u.stored_name}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 rounded-md border border-gray-600 px-3 py-2 text-sm hover:border-gray-400">
                <span>{u.filename}</span>
                <span className="text-xs text-gray-400">{u.mime_type}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Link href={`/expenses/${id}/edit`}>
          <Button variant="outline">Edit</Button>
        </Link>
        <Button variant="destructive" onClick={deleteExpense}>Delete</Button>
      </div>
    </div>
  );
}
