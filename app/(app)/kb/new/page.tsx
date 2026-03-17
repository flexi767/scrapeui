'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TiptapEditor } from '@/components/editor/TiptapEditor';

interface LabelOption { id: number; name: string; color: string; }
interface ListingOption { id: number; mobile_id: string; title: string; make: string; model: string; }

export default function NewArticlePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<number[]>([]);
  const [selectedListings, setSelectedListings] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const [labels, setLabels] = useState<LabelOption[]>([]);
  const [listings, setListings] = useState<ListingOption[]>([]);

  useEffect(() => {
    fetch('/api/labels').then(r => r.json()).then(setLabels);
    fetch('/api/listings?limit=500').then(r => r.json()).then(d => setListings(d.data || []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const res = await fetch('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, content, labelIds: selectedLabels, listingIds: selectedListings,
      }),
    });

    if (res.ok) {
      const { slug } = await res.json();
      router.push(`/kb/${slug}`);
    } else {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">New Article</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus placeholder="Article title" />
        </div>

        <div className="space-y-2">
          <Label>Content</Label>
          <TiptapEditor content={content} onChange={setContent} placeholder="Write your article..." />
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

        <div className="space-y-2">
          <Label>Linked Cars</Label>
          <div className="max-h-40 overflow-y-auto rounded-md border border-gray-600 bg-gray-800 p-2">
            {listings.map((l) => (
              <label key={l.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-700">
                <input type="checkbox" checked={selectedListings.includes(l.id)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedListings([...selectedListings, l.id]);
                    else setSelectedListings(selectedListings.filter(x => x !== l.id));
                  }} />
                <span className="truncate">{l.make} {l.model} — {l.title || l.mobile_id}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Article'}</Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
