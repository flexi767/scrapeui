'use client';

import dynamic from 'next/dynamic';

export const LazyTiptapEditor = dynamic(
  () => import('./TiptapEditor').then((mod) => mod.TiptapEditor),
  {
    loading: () => (
      <div className="min-h-[164px] rounded-md border border-gray-600 bg-gray-800 px-4 py-3 text-sm text-gray-500">
        Loading editor...
      </div>
    ),
  },
);
