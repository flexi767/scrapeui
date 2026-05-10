import { USER_AGENT } from './constants';

export async function fetchWin1251(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, ...init });
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new TextDecoder('windows-1251').decode(buf);
}
