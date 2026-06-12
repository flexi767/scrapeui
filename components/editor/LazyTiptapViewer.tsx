'use client';

import dynamic from 'next/dynamic';

export const LazyTiptapViewer = dynamic(
  () => import('./TiptapViewer').then((mod) => mod.TiptapViewer),
  {
    loading: () => (
      <div className="min-h-[48px] rounded-md bg-gray-800/60 px-4 py-3 text-sm text-gray-500">
        Loading content...
      </div>
    ),
  },
);
