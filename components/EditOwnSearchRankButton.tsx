'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

export default function EditOwnSearchRankButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);

  async function run(missingOnly = false) {
    setRunning(true);
    try {
      const res = await fetch('/api/editown/search-ranks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missingOnly }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Search check failed');
      }

      toast.success(`Checked ${data.total} listings • found ${data.found} • missing ${data.notFound}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Search check failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => void run(false)}
        disabled={running}
        className="rounded border border-amber-500/60 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {running ? 'Checking…' : 'Check search positions'}
      </button>
      <button
        onClick={() => void run(true)}
        disabled={running}
        className="rounded border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        Missing only
      </button>
    </div>
  );
}
