'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CategoryBadge, EXPENSE_CATEGORIES } from '@/components/shared/CategoryBadge';

interface ExpenseRow {
  id: number;
  title: string;
  amount: number;
  currency: string;
  date: string;
  category: string;
  creator_name: string | null;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (search) params.set('search', search);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);

    setLoading(true);
    fetch(`/api/expenses?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setExpenses(data.data);
        setTotal(data.total);
        setTotalAmount(data.totalAmount);
      })
      .finally(() => setLoading(false));
  }, [category, search, dateFrom, dateTo]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-sm text-gray-400">
            {total} expenses — Total: {formatAmount(totalAmount)} BGN
          </p>
        </div>
        <Link href="/expenses/new">
          <Button>New Expense</Button>
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200"
        >
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        <span className="self-center text-gray-400">to</span>
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : expenses.length === 0 ? (
        <p className="text-gray-400">No expenses found.</p>
      ) : (
        <div className="space-y-2">
          {expenses.map((exp) => (
            <Link
              key={exp.id}
              href={`/expenses/${exp.id}`}
              className="flex items-center gap-4 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 transition-colors hover:border-gray-500"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gray-100">{exp.title}</p>
                <p className="mt-0.5 text-xs text-gray-400">{exp.date}</p>
              </div>
              <CategoryBadge category={exp.category} />
              <span className="font-mono text-sm font-medium text-gray-200">
                {formatAmount(exp.amount)} {exp.currency}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}
