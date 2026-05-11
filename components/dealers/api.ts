import { readJsonResponse } from '@/lib/utils';
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
  const data = await readJsonResponse(response);

  if (!response.ok) return { ok: false, error: (data.error as string | undefined) || 'Failed to add' };
  return { ok: true, data: data as unknown as Dealer };
}

export async function patchDealer(id: number, body: Partial<DealerEditForm> | Partial<Dealer>): Promise<ApiResult<unknown>> {
  const response = await fetch(`/api/dealers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await readJsonResponse(response);

  if (!response.ok) return { ok: false, error: (data.error as string | undefined) || 'Failed to save' };
  return { ok: true, data };
}

export async function deleteDealer(id: number) {
  await fetch(`/api/dealers/${id}`, { method: 'DELETE' });
}

export async function testDealerLogins(id: number) {
  const response = await fetch('/api/dealers/test-logins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: [id] }),
  });
  return response.json() as Promise<Record<number, DealerLoginResult>>;
}
