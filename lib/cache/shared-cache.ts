import { createTtlCache } from '@/lib/ttl-cache';

export interface SharedCache<T> {
  get(key: string, compute: () => T): T;
  peek(key: string): T | undefined;
  set(key: string, value: T): void;
  delete(key: string): void;
  deleteByPrefix(prefix: string): void;
  clear(): void;
}

export interface SharedCacheOptions {
  namespace: string;
  ttlMs: number;
  maxEntries: number;
}

export function createSharedCache<T>({
  namespace,
  ttlMs,
  maxEntries,
}: SharedCacheOptions): SharedCache<T> {
  const cache = createTtlCache<T>({ ttlMs, maxEntries });
  const keys = new Set<string>();

  function namespaced(key: string) {
    return `${namespace}:${key}`;
  }

  return {
    get(key, compute) {
      const fullKey = namespaced(key);
      keys.add(fullKey);
      return cache.get(fullKey, compute);
    },
    peek(key) {
      return cache.peek(namespaced(key));
    },
    set(key, value) {
      const fullKey = namespaced(key);
      keys.add(fullKey);
      cache.set(fullKey, value);
    },
    delete(key) {
      const fullKey = namespaced(key);
      keys.delete(fullKey);
      cache.delete(fullKey);
    },
    deleteByPrefix(prefix) {
      const fullPrefix = namespaced(prefix);
      for (const key of [...keys]) {
        if (key.startsWith(fullPrefix)) {
          keys.delete(key);
          cache.delete(key);
        }
      }
    },
    clear() {
      keys.clear();
      cache.clear();
    },
  };
}
