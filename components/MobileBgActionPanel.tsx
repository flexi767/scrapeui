'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';

interface DealerOption {
  slug: string;
  name: string;
}

interface Props {
  dealers: DealerOption[];
  defaultDealerSlug?: string | null;
  mobileId?: string | null;
  backupId?: number | null;
}

export function MobileBgActionPanel({ dealers, defaultDealerSlug, mobileId, backupId }: Props) {
  const initialDealer = useMemo(() => defaultDealerSlug || dealers[0]?.slug || '', [defaultDealerSlug, dealers]);
  const [dealerSlug, setDealerSlug] = useState(initialDealer);
  const [backupRunning, setBackupRunning] = useState(false);
  const [editRunning, setEditRunning] = useState(false);
  const [repostRunning, setRepostRunning] = useState(false);

  async function runAction(
    endpoint: string,
    payload: Record<string, unknown>,
    setRunning: (value: boolean) => void,
    successMessage: string,
  ) {
    setRunning(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Action failed');
        return;
      }
      toast.success(successMessage);
      if (typeof window !== 'undefined') window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4 space-y-4">
      <div>
        <h2 className="text-sm font-medium text-gray-200">Actions</h2>
        <p className="mt-1 text-xs text-gray-500">Run backup, edit-form capture, and repost flows directly from scrapeui.</p>
      </div>

      <div className="space-y-2">
        <label className="block text-xs uppercase tracking-wide text-gray-500">Dealer</label>
        <select
          value={dealerSlug}
          onChange={(e) => setDealerSlug(e.target.value)}
          className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
        >
          {dealers.map((dealer) => (
            <option key={dealer.slug} value={dealer.slug}>{dealer.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => runAction('/api/mobilebg/backup', { dealerSlug }, setBackupRunning, 'Backup completed')}
          disabled={!dealerSlug || backupRunning}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {backupRunning ? 'Running backup…' : 'Run backup'}
        </button>

        <button
          onClick={() => mobileId && runAction('/api/mobilebg/edit-forms', { dealerSlug, mobileId }, setEditRunning, 'Edit form captured')}
          disabled={!dealerSlug || !mobileId || editRunning}
          className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {editRunning ? 'Capturing…' : 'Capture edit form'}
        </button>

        <button
          onClick={() => backupId && runAction('/api/mobilebg/reposts', { dealerSlug, backupId }, setRepostRunning, 'Repost completed')}
          disabled={!dealerSlug || !backupId || repostRunning}
          className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {repostRunning ? 'Reposting…' : 'Repost backup'}
        </button>
      </div>
    </div>
  );
}
