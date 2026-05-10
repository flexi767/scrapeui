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
  const [selectedDealerSlugs, setSelectedDealerSlugs] = useState<string[]>(initialDealer ? [initialDealer] : []);
  const [editRunning, setEditRunning] = useState(false);
  const [updateRunning, setUpdateRunning] = useState(false);
  const [repostRunning, setRepostRunning] = useState(false);
  const isDraftOnly = !mobileId;
  const dealerSlug = selectedDealerSlugs[0] ?? '';

  function toggleDealer(slug: string) {
    setSelectedDealerSlugs((prev) => (
      prev.includes(slug) ? prev.filter((value) => value !== slug) : [...prev, slug]
    ));
  }

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
        <p className="mt-1 text-xs text-gray-500">Run edit-form capture and repost flows directly from scrapeui.</p>
      </div>

      <div className="space-y-2">
        <label className="block text-xs uppercase tracking-wide text-gray-500">Dealer</label>
        <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-gray-600 bg-gray-800 px-3 py-2">
          {dealers.map((dealer) => {
            const checked = selectedDealerSlugs.includes(dealer.slug);
            return (
              <label key={dealer.slug} className="flex cursor-pointer items-center gap-2 text-sm text-gray-200">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleDealer(dealer.slug)}
                  className="accent-blue-500"
                />
                <span>{dealer.name}</span>
              </label>
            );
          })}
        </div>
        {selectedDealerSlugs.length > 1 ? (
          <p className="text-xs text-amber-300">Capture/Update/Repost use a single dealer. Leave only one checked for those actions.</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => mobileId && runAction('/api/mobilebg/edit-forms', { dealerSlug, mobileId }, setEditRunning, 'Edit form captured')}
          disabled={!dealerSlug || selectedDealerSlugs.length !== 1 || !mobileId || editRunning}
          className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {editRunning ? 'Capturing…' : 'Capture edit form'}
        </button>

        <button
          onClick={() => backupId && runAction('/api/mobilebg/updates', { dealerSlug, backupId }, setUpdateRunning, 'Listing updated on mobile.bg')}
          disabled={!dealerSlug || selectedDealerSlugs.length !== 1 || !backupId || !mobileId || updateRunning}
          className="rounded-md bg-violet-700 px-3 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {updateRunning ? 'Updating…' : 'Update on mobile.bg'}
        </button>

        <button
          onClick={() => backupId && runAction(
            '/api/mobilebg/reposts',
            { dealerSlug, backupId },
            setRepostRunning,
            isDraftOnly ? 'Listing published to mobile.bg' : 'Repost completed',
          )}
          disabled={!dealerSlug || selectedDealerSlugs.length !== 1 || !backupId || repostRunning}
          className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {repostRunning ? (isDraftOnly ? 'Publishing…' : 'Reposting…') : (isDraftOnly ? 'Publish to mobile.bg' : 'Repost backup')}
        </button>
      </div>

    </div>
  );
}
