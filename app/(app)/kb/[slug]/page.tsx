'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { TiptapViewer } from '@/components/editor/TiptapViewer';

interface ArticleDetail {
  id: number;
  title: string;
  slug: string;
  body: string;
  author_name: string;
  created_at: string;
  updated_at: string;
  labels: { id: number; name: string; color: string }[];
  listings: { id: number; mobile_id: string; title: string; make: string; model: string }[];
  uploads: { id: number; filename: string; stored_name: string }[];
}

export default function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [article, setArticle] = useState<ArticleDetail | null>(null);

  useEffect(() => {
    // We use slug to fetch from a custom endpoint
    fetch(`/api/articles?search=${encodeURIComponent(slug)}&limit=1`)
      .then(r => r.json())
      .then(data => {
        const match = data.data?.find((a: { slug: string }) => a.slug === slug);
        if (match) {
          // Fetch full detail by id
          fetch(`/api/articles/${match.id}`).then(r => {
            if (r.ok) return r.json();
            // If no detail endpoint returns article, use the list data
            return match;
          }).then(setArticle).catch(() => setArticle(match));
        }
      });
  }, [slug]);

  async function deleteArticle() {
    if (!article || !confirm('Delete this article?')) return;
    await fetch(`/api/articles/${article.id}`, { method: 'DELETE' });
    router.push('/kb');
  }

  if (!article) return <p className="text-gray-400">Loading...</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{article.title}</h1>
        <p className="mt-1 text-sm text-gray-400">
          By {article.author_name} — Updated {new Date(article.updated_at).toLocaleDateString()}
        </p>
      </div>

      {article.labels?.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1">
          {article.labels.map((l) => (
            <span key={l.id} className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: l.color, color: '#fff' }}>
              {l.name}
            </span>
          ))}
        </div>
      )}

      {article.listings?.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-1 text-sm font-medium text-gray-400">Linked Cars</h3>
          <div className="flex flex-wrap gap-2">
            {article.listings.map((l) => (
              <Link key={l.id} href={`/listings/${l.mobile_id}`}
                className="rounded-md border border-gray-600 px-2 py-1 text-xs hover:border-gray-400">
                {l.make} {l.model}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-700 bg-gray-800 p-6">
        <TiptapViewer content={article.body} />
      </div>

      {article.uploads?.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-gray-400">Attachments</h3>
          <div className="space-y-1">
            {article.uploads.map((u) => (
              <a key={u.id} href={`/api/uploads/${u.stored_name}`} target="_blank" rel="noreferrer"
                className="block rounded-md border border-gray-600 px-3 py-2 text-sm hover:border-gray-400">
                {u.filename}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-2">
        <Link href={`/kb/${slug}/edit`}>
          <Button variant="outline">Edit</Button>
        </Link>
        <Button variant="destructive" onClick={deleteArticle}>Delete</Button>
      </div>
    </div>
  );
}
