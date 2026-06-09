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

export function userHasPageKey(pageKeys: string[] | undefined, key: PageKey): boolean {
  return Array.isArray(pageKeys) && pageKeys.includes(key);
}
