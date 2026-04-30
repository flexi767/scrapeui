import type { EditOwnSyncRow } from '@/lib/queries';
import { readJsonError } from '@/lib/streaming-job';
import { isEditOwnSyncRow } from './helpers';

export async function revertDraftToSource(backupId: number) {
  const res = await fetch(`/api/editown/sync-drafts/${backupId}`, { method: 'POST' });
  const data = await res.json().catch(() => null) as EditOwnSyncRow | { error?: string } | null;
  if (!res.ok || !isEditOwnSyncRow(data)) {
    throw new Error((data && 'error' in data ? data.error : null) || 'Failed to revert draft');
  }

  return data;
}

export async function startBatchSync(signal: AbortSignal) {
  const res = await fetch('/api/editown/batch-sync', {
    method: 'POST',
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(await readJsonError(res, 'Failed to start batch sync'));
  }

  return res;
}

export async function stopBatchSync() {
  const res = await fetch('/api/editown/batch-sync', { method: 'DELETE' });
  const data = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Failed to stop batch sync');
  }
}

export async function startRenewReset({
  dealerSlugs,
  onlyReset,
  signal,
}: {
  dealerSlugs: string[];
  onlyReset: boolean;
  signal: AbortSignal;
}) {
  const res = await fetch('/api/editown/renew-reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dealerSlugs, onlyReset }),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(await readJsonError(res, 'Failed to start renew & reset'));
  }

  return res;
}

export async function stopRenewResetJob() {
  const res = await fetch('/api/editown/renew-reset', { method: 'DELETE' });
  const data = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) throw new Error(data.error || 'Failed to stop');
}
