import type { Dealer, DealerCreateForm, DealerEditForm, DealerLoginResult } from './types';

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function parseJson(response: Response) {
  return response.json().catch(() => ({}));
}

function failureMessage(data: unknown, fallback: string) {
  return typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
    ? data.error
    : fallback;
}

export async function createDealer(form: DealerCreateForm): Promise<ApiResult<Dealer>> {
  const response = await fetch('/api/dealers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  });
  const data = await parseJson(response);

  if (!response.ok) return { ok: false, error: failureMessage(data, 'Failed to add') };
  return { ok: true, data: data as Dealer };
}

export async function patchDealer(id: number, body: Partial<DealerEditForm> | Partial<Dealer>): Promise<ApiResult<unknown>> {
  const response = await fetch(`/api/dealers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await parseJson(response);

  if (!response.ok) return { ok: false, error: failureMessage(data, 'Failed to save') };
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
