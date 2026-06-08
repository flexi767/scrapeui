import { OwnListingRow } from '@/lib/queries';
import { apiRequest } from '@/lib/utils';
import {
  buildOwnListingPatchBody,
  getOwnListingSaveEndpoint,
  type OwnListingEditForm,
} from './editing';

export async function saveOwnListingEdit(row: OwnListingRow, form: OwnListingEditForm) {
  return apiRequest<unknown>(getOwnListingSaveEndpoint(row), 'Save failed', {
    method: 'PATCH',
    json: buildOwnListingPatchBody(form),
  });
}

export async function syncOwnListingToMobileBg(row: OwnListingRow) {
  await apiRequest<unknown>('/api/mobilebg/updates', 'Sync failed', {
    method: 'POST',
    json: {
      dealerSlug: row.dealer_slug,
      backupId: row.backup_id,
    },
  });
}

export async function launchFacebookMarketplaceDraft(row: OwnListingRow) {
  const data = await apiRequest<{ message?: string }>('/api/facebook-marketplace', 'Failed to launch Facebook Marketplace', {
    method: 'POST',
    json: { backupId: row.backup_id },
  });

  return data.message ?? 'Facebook Marketplace browser launched';
}
