import { raw } from '@/db/client';

export const PAGE_KEYS = [
  'listings',
  'editown',
  'mobilebg',
  'tasks',
  'expenses',
  'templates',
  'translations',
  'config',
  'mapping',
  'kb',
  'files',
  'dealers',
] as const;

export type PageKey = (typeof PAGE_KEYS)[number];

export function isPageKey(value: string): value is PageKey {
  return (PAGE_KEYS as readonly string[]).includes(value);
}

// Always visible to every authenticated user, regardless of grants.
export const ALWAYS_VISIBLE_KEYS = ['dashboard'] as const;

interface PermissionRow {
  page_key: string;
}

/**
 * Returns the set of page keys a user is allowed to see.
 * Admins always get every key; everyone else gets the always-visible
 * keys plus whatever has been explicitly granted in user_page_permissions.
 */
export function getUserPageKeys(userId: number, role: string): string[] {
  if (role === 'admin') {
    return [...ALWAYS_VISIBLE_KEYS, ...PAGE_KEYS];
  }

  const rows = raw
    .prepare('SELECT page_key FROM user_page_permissions WHERE user_id = ?')
    .all(userId) as PermissionRow[];

  return [...ALWAYS_VISIBLE_KEYS, ...rows.map((row) => row.page_key)];
}

export function userHasPageKey(pageKeys: string[] | undefined, key: PageKey): boolean {
  return Array.isArray(pageKeys) && pageKeys.includes(key);
}
