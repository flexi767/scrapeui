'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ArticleRow {
  id: number;
  title: string;
  slug: string;
  author_name: string;
  updated_at: string;
}

export default function KBPage() {
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);

    setLoading(true);
    fetch(`/api/articles?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setArticles(data.data);
        setTotal(data.total);
      })
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-sm text-gray-400">{total} articles</p>
        </div>
        <Link href="/kb/new">
          <Button>New Article</Button>
        </Link>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search articles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : articles.length === 0 ? (
        <p className="text-gray-400">No articles found.</p>
      ) : (
        <div className="space-y-2">
          {articles.map((article) => (
            <Link
              key={article.id}
              href={`/kb/${article.slug}`}
              className="block rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 transition-colors hover:border-gray-500"
            >
              <p className="font-medium text-gray-100">{article.title}</p>
              <p className="mt-0.5 text-xs text-gray-400">
                By {article.author_name} — Updated {new Date(article.updated_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
