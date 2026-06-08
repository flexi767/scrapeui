import { apiRequest, errorMessage } from '@/lib/utils';
import type { Dealer, DealerCreateForm, DealerEditForm, DealerLoginResult } from './types';

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function createDealer(form: DealerCreateForm): Promise<ApiResult<Dealer>> {
  try {
    const data = await apiRequest<Dealer>('/api/dealers', 'Failed to add', {
      method: 'POST',
      json: form,
    });
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: errorMessage(error, 'Failed to add') };
  }
}

export async function patchDealer(id: number, body: Partial<DealerEditForm> | Partial<Dealer>): Promise<ApiResult<unknown>> {
  try {
    const data = await apiRequest<unknown>(`/api/dealers/${id}`, 'Failed to save', {
      method: 'PATCH',
      json: body,
    });
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: errorMessage(error, 'Failed to save') };
  }
}

export async function deleteDealer(id: number) {
  await apiRequest<unknown>(`/api/dealers/${id}`, 'Failed to delete dealer', { method: 'DELETE' });
}

export async function testDealerLogins(id: number) {
  return apiRequest<Record<number, DealerLoginResult>>('/api/dealers/test-logins', 'Login test failed', {
    method: 'POST',
    json: { ids: [id] },
  });
}
