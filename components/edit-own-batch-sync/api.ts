import type { EditOwnSyncRow } from '@/lib/queries';
import { readJsonError } from '@/lib/streaming-job';
import { parseApiResponse } from '@/lib/utils';
import { isEditOwnSyncRow } from './helpers';

export async function revertDraftToSource(backupId: number) {
  const res = await fetch(`/api/editown/sync-drafts/${backupId}`, { method: 'POST' });
  const data = await parseApiResponse<EditOwnSyncRow | null>(res, 'Failed to revert draft');
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
  const res = await fetch('/api/editown/batch-sync', { method: 'DELETE' });
  await parseApiResponse<unknown>(res, 'Failed to stop batch sync');
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
  await parseApiResponse<unknown>(res, 'Failed to stop');
}
