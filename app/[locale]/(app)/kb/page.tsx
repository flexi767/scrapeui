
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDateOnly } from '@/lib/date-format';

interface ArticleRow {
  id: number;
  title: string;
  slug: string;
  author_name: string;
  updated_at: string;
}

export default function KBPage() {
  const t = useTranslations('ui');
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);

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
          <h1 className="text-2xl font-bold">{t('knowledge_base')}</h1>
          <p className="text-sm text-gray-400">{total} {t('articles')}</p>
        </div>
        <Link href="/kb/new">
          <Button>{t('new_article')}</Button>
        </Link>
      </div>

      <div className="mb-4">
        <Input
          placeholder={t('search_articles')}
          value={search}
          onChange={(e) => {
            setLoading(true);
            setSearch(e.target.value);
          }}
          className="w-64"
        />
      </div>

      {loading ? (
        <p className="text-gray-400">{t('loading')}</p>
      ) : articles.length === 0 ? (
        <p className="text-gray-400">{t('no_articles_found')}</p>
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
                By {article.author_name} — Updated {formatDateOnly(article.updated_at)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
