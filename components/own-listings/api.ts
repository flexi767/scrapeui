import { OwnListingRow } from '@/lib/queries';
import { parseApiResponse } from '@/lib/utils';
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
  return parseApiResponse<unknown>(res, 'Save failed');
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
  await parseApiResponse<unknown>(res, 'Sync failed');
}

export async function launchFacebookMarketplaceDraft(row: OwnListingRow) {
  const res = await fetch('/api/facebook-marketplace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ backupId: row.backup_id }),
  });
  const data = await parseApiResponse<{ message?: string }>(res, 'Failed to launch Facebook Marketplace');

  return data.message ?? 'Facebook Marketplace browser launched';
}
