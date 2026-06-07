
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TiptapEditor } from '@/components/editor/TiptapEditor';
import { LinkedCarsSelector } from '@/components/shared/LinkedCarsSelector';
import type { LabelRow } from '@/lib/queries';
import { parseApiResponse } from '@/lib/utils';

export default function NewArticlePage() {
  const t = useTranslations('ui');
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<number[]>([]);
  const [selectedListings, setSelectedListings] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const [labels, setLabels] = useState<LabelRow[]>([]);

  useEffect(() => {
    fetch('/api/labels').then(r => r.json()).then(setLabels);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, content, labelIds: selectedLabels, listingIds: selectedListings,
        }),
      });
      const { slug } = await parseApiResponse<{ slug: string }>(res, 'Failed to create article');
      router.push(`/kb/${slug}`);
    } catch {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">{t('new_article')}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label>{t('title')}</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus placeholder={t('article_title_placeholder')} />
        </div>

        <div className="space-y-2">
          <Label>{t('content')}</Label>
          <TiptapEditor content={content} onChange={setContent} placeholder={t('write_your_article')} />
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

        <LinkedCarsSelector selected={selectedListings} onChange={setSelectedListings} />

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>{saving ? t('creating') : t('create_article')}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>{t('cancel')}</Button>
        </div>
      </form>
    </div>
  );
}
