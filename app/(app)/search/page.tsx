'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SearchResult {
  type: 'task' | 'listing' | 'expense' | 'article';
  id: number;
  title: string;
  subtitle: string;
  url: string;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);

    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      setResults(await res.json());
    }
    setLoading(false);
  }

  const typeColors: Record<string, string> = {
    task: 'text-blue-400',
    listing: 'text-green-400',
    expense: 'text-yellow-400',
    article: 'text-purple-400',
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">Search</h1>

      <form onSubmit={handleSearch} className="mb-6 flex gap-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search across tasks, cars, expenses, articles..."
          autoFocus
          className="flex-1"
        />
        <Button type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </form>

      {searched && !loading && results.length === 0 && (
        <p className="text-gray-400">No results found.</p>
      )}

      <div className="space-y-2">
        {results.map((r, i) => (
          <Link
            key={`${r.type}-${r.id}-${i}`}
            href={r.url}
            className="block rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 transition-colors hover:border-gray-500"
          >
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium uppercase ${typeColors[r.type] ?? 'text-gray-400'}`}>
                {r.type}
              </span>
              <span className="font-medium text-gray-100">{r.title}</span>
            </div>
            {r.subtitle && (
              <p className="mt-0.5 text-xs text-gray-400">{r.subtitle}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
