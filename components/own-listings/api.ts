import { OwnListingRow } from '@/lib/queries';
import { readJsonError } from '@/lib/streaming-job';
import {
  buildOwnListingPatchBody,
  getOwnListingSaveEndpoint,
  type OwnListingEditForm,
} from './editing';

export async function saveOwnListingEdit(row: OwnListingRow, form: OwnListingEditForm) {
  const res = await fetch(getOwnListingSaveEndpoint(row), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildOwnListingPatchBody(form)),
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error((data as { error?: string } | null)?.error ?? 'Save failed');
  }

  return data;
}

export async function syncOwnListingToMobileBg(row: OwnListingRow) {
  const res = await fetch('/api/mobilebg/updates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dealerSlug: row.dealer_slug,
      backupId: row.backup_id,
    }),
  });
  if (!res.ok) throw new Error(await readJsonError(res, 'Sync failed'));
}

export async function launchFacebookMarketplaceDraft(row: OwnListingRow) {
  const res = await fetch('/api/facebook-marketplace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ backupId: row.backup_id }),
  });
  const data = await res.json().catch(() => ({})) as { error?: string; message?: string };

  if (!res.ok) {
    throw new Error(data.error ?? 'Failed to launch Facebook Marketplace');
  }

  return data.message ?? 'Facebook Marketplace browser launched';
}
