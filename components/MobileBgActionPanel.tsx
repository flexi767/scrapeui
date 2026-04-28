'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { readJsonError, streamJsonEvents } from '@/lib/streaming-job';

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

interface BackupLogEntry {
  type: 'status' | 'listing' | 'complete' | 'error';
  dealer?: string;
  message?: string;
  total?: number;
  current?: number;
  action?: 'created' | 'updated';
  mobileId?: string;
  make?: string;
  model?: string;
  title?: string;
  url?: string;
  previewUrl?: string;
  imageCount?: number;
  views?: number | null;
  watching?: number | null;
  adStatus?: 'TOP' | 'VIP' | 'none';
  listingsCount?: number;
  imagesCount?: number;
}

export function MobileBgActionPanel({ dealers, defaultDealerSlug, mobileId, backupId }: Props) {
  const initialDealer = useMemo(() => defaultDealerSlug || dealers[0]?.slug || '', [defaultDealerSlug, dealers]);
  const [selectedDealerSlugs, setSelectedDealerSlugs] = useState<string[]>(initialDealer ? [initialDealer] : []);
  const [backupRunning, setBackupRunning] = useState(false);
  const [editRunning, setEditRunning] = useState(false);
  const [updateRunning, setUpdateRunning] = useState(false);
  const [repostRunning, setRepostRunning] = useState(false);
  const [backupLog, setBackupLog] = useState<BackupLogEntry[]>([]);
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

  async function runBackup() {
    setBackupRunning(true);
    setBackupLog([]);

    try {
      const res = await fetch('/api/mobilebg/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealerSlugs: selectedDealerSlugs }),
      });

      if (!res.ok || !res.body) {
        toast.error(await readJsonError(res, 'Backup failed'));
        return;
      }

      let completed = false;

      await streamJsonEvents<BackupLogEntry>(res, (payload) => {
        setBackupLog((prev) => [...prev, payload]);

        if (payload.type === 'error') {
          toast.error(payload.message || 'Backup failed');
        }

        if (payload.type === 'complete') {
          completed = true;
          toast.success(`Backup completed: ${payload.listingsCount ?? 0} listings, ${payload.imagesCount ?? 0} images`);
        }
      });

      if (!completed) {
        toast.error('Backup ended without a completion event');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Backup failed');
    } finally {
      setBackupRunning(false);
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
          onClick={runBackup}
          disabled={selectedDealerSlugs.length === 0 || backupRunning}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {backupRunning ? 'Running backup…' : 'Run backup'}
        </button>

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

      {(backupRunning || backupLog.length > 0) && (
        <div className="rounded-lg border border-gray-700 bg-gray-950/50">
          <div className="border-b border-gray-700 px-4 py-3">
            <div className="text-sm font-medium text-gray-200">Live backup feedback</div>
            <p className="mt-1 text-xs text-gray-500">Shows what the backup is saving in real time.</p>
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto px-4 py-3">
            {backupLog.map((entry, index) => (
              entry.type === 'listing' ? (
                <div key={`${entry.mobileId || index}-${index}`} className="rounded-md border border-gray-800 bg-gray-900/70 px-3 py-2">
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-20 shrink-0 overflow-hidden rounded-md border border-gray-800 bg-gray-950">
                      {entry.previewUrl ? (
                        <div
                          role="img"
                          aria-label={[entry.make, entry.model].filter(Boolean).join(' ') || entry.mobileId || 'Listing'}
                          style={{ backgroundImage: `url("${entry.previewUrl}")` }}
                          className="h-full w-full bg-cover bg-center"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-wide text-gray-600">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-white">
                            {[entry.make, entry.model].filter(Boolean).join(' ') || entry.mobileId || 'Listing'}
                          </div>
                          <div className="truncate text-xs text-gray-400">{entry.title || entry.mobileId || '—'}</div>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${entry.action === 'created' ? 'bg-emerald-900/60 text-emerald-200' : 'bg-amber-900/60 text-amber-200'}`}>
                          {entry.action === 'created' ? 'new' : 'updated'}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                        <span>{entry.current ?? 0}/{entry.total ?? 0}</span>
                        <span>{entry.imageCount ?? 0} images</span>
                        {entry.adStatus && entry.adStatus !== 'none' ? <span>{entry.adStatus}</span> : null}
                        {entry.views != null ? <span>{entry.views} views</span> : null}
                        {entry.watching != null ? <span>{entry.watching} watching</span> : null}
                        {entry.url ? (
                          <a href={entry.url} target="_blank" rel="noreferrer" className="text-blue-300 hover:text-blue-200">
                            open
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div key={`${entry.type}-${index}`} className="rounded-md border border-gray-800 bg-gray-900/40 px-3 py-2 text-sm">
                  <div className={`${entry.type === 'error' ? 'text-red-300' : entry.type === 'complete' ? 'text-emerald-300' : 'text-gray-300'}`}>
                    {entry.message || entry.type}
                  </div>
                </div>
              )
            ))}
            {backupLog.length === 0 ? (
              <div className="text-sm text-gray-500">Waiting for backup progress…</div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
