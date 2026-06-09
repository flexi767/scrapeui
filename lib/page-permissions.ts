import { raw } from '@/db/client';
export { PAGE_KEYS, type PageKey, isPageKey, ALWAYS_VISIBLE_KEYS, userHasPageKey } from './page-keys';
import { PAGE_KEYS, ALWAYS_VISIBLE_KEYS } from './page-keys';

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
