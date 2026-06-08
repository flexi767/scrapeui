
'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TiptapEditor } from '@/components/editor/TiptapEditor';
import { apiRequest } from '@/lib/utils';
import type { ArticleDetailRow, ArticleRow, LabelRow } from '@/lib/queries';

interface ArticlesResponse {
  data?: ArticleRow[];
}

export default function EditArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const t = useTranslations('ui');
  const router = useRouter();
  const [articleId, setArticleId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [labels, setLabels] = useState<LabelRow[]>([]);

  useEffect(() => {
    Promise.all([
      apiRequest<ArticlesResponse>(`/api/articles?search=${encodeURIComponent(slug)}&limit=1`, 'Failed to load article'),
      apiRequest<LabelRow[]>('/api/labels', 'Failed to load labels'),
    ]).then(async ([articlesData, labelsData]) => {
      const article = articlesData.data?.find((a) => a.slug === slug);
      if (article) {
        const detail = await apiRequest<ArticleDetailRow>(`/api/articles/${article.id}`, 'Failed to load article details');
        setArticleId(detail.id);
        setTitle(detail.title);
        setContent(detail.body || '');
        setSelectedLabels(detail.labels.map((label) => label.id));
      }
      setLabels(labelsData);
      setLoaded(true);
    });
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!articleId) return;
    setSaving(true);

    await apiRequest<unknown>(`/api/articles/${articleId}`, 'Failed to save article', {
      method: 'PATCH',
      json: {
        title, content, labelIds: selectedLabels,
      },
    });

    router.push(`/kb/${slug}`);
  }

  if (!loaded) return <p className="text-gray-400">{t('loading')}</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">{t('edit_article')}</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label>{t('title')}</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>{t('content')}</Label>
          <TiptapEditor content={content} onChange={setContent} />
        </div>
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
          <Button type="submit" disabled={saving}>{saving ? t('saving') : t('save_changes')}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>{t('cancel')}</Button>
        </div>
      </form>
    </div>
  );
}
