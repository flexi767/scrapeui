'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TiptapEditor } from '@/components/editor/TiptapEditor';

export default function EditArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [articleId, setArticleId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<number[]>([]);
  const [selectedListings, setSelectedListings] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [labels, setLabels] = useState<{ id: number; name: string; color: string }[]>([]);
  const [listings, setListings] = useState<{ id: number; make: string; model: string; title: string; mobile_id: string }[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/articles?search=${encodeURIComponent(slug)}&limit=1`).then(r => r.json()),
      fetch('/api/labels').then(r => r.json()),
      fetch('/api/listings?limit=500').then(r => r.json()),
    ]).then(([articlesData, labelsData, listingsData]) => {
      const article = articlesData.data?.find((a: { slug: string }) => a.slug === slug);
      if (article) {
        setArticleId(article.id);
        setTitle(article.title);
        setContent(article.body || '');
      }
      setLabels(labelsData);
      setListings(listingsData.data || []);
      setLoaded(true);
    });
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!articleId) return;
    setSaving(true);

    await fetch(`/api/articles/${articleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, content, labelIds: selectedLabels, listingIds: selectedListings,
      }),
    });

    router.push(`/kb/${slug}`);
  }

  if (!loaded) return <p className="text-gray-400">Loading...</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">Edit Article</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Content</Label>
          <TiptapEditor content={content} onChange={setContent} />
        </div>
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
          <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
