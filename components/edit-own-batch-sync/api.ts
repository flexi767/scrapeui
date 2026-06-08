import type { EditOwnSyncRow } from '@/lib/queries';
import { readJsonError } from '@/lib/streaming-job';
import { apiRequest } from '@/lib/utils';
import { isEditOwnSyncRow } from './helpers';

export async function revertDraftToSource(backupId: number) {
  const data = await apiRequest<EditOwnSyncRow | null>(
    `/api/editown/sync-drafts/${backupId}`,
    'Failed to revert draft',
    { method: 'POST' },
  );
  if (!isEditOwnSyncRow(data)) {
    throw new Error('Failed to revert draft');
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
  await apiRequest<unknown>('/api/editown/batch-sync', 'Failed to stop batch sync', { method: 'DELETE' });
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
  await apiRequest<unknown>('/api/editown/renew-reset', 'Failed to stop', { method: 'DELETE' });
}
