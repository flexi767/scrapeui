import { errorMessage, parseApiResponse } from '@/lib/utils';
import type { Dealer, DealerCreateForm, DealerEditForm, DealerLoginResult } from './types';

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function createDealer(form: DealerCreateForm): Promise<ApiResult<Dealer>> {
  const response = await fetch('/api/dealers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  });
  try {
    const data = await parseApiResponse<Dealer>(response, 'Failed to add');
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: errorMessage(error, 'Failed to add') };
  }
}

export async function patchDealer(id: number, body: Partial<DealerEditForm> | Partial<Dealer>): Promise<ApiResult<unknown>> {
  const response = await fetch(`/api/dealers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  try {
    const data = await parseApiResponse<unknown>(response, 'Failed to save');
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: errorMessage(error, 'Failed to save') };
  }
}

export async function deleteDealer(id: number) {
  const response = await fetch(`/api/dealers/${id}`, { method: 'DELETE' });
  await parseApiResponse<unknown>(response, 'Failed to delete dealer');
}

export async function testDealerLogins(id: number) {
  const response = await fetch('/api/dealers/test-logins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: [id] }),
  });
  return parseApiResponse<Record<number, DealerLoginResult>>(response, 'Login test failed');
}
