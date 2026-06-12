/**
 * Tiny in-process TTL cache with a bounded FIFO eviction policy.
 *
 * SINGLE-NODE ONLY: entries live in the Node.js process heap.
 * Consistent with the app's architecture (see CLAUDE.md — Architecture Constraints).
 * Do not use this module in a horizontally-scaled deployment without replacing it
 * with a shared cache (e.g. Redis).
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // Date.now() + ttlMs
}

export interface TtlCache<T> {
  /** Return the cached value if present and unexpired; otherwise return undefined. */
  peek(key: string): T | undefined;
  /** Return the cached value if present and unexpired; otherwise call `compute`, cache, and return its result. */
  get(key: string, compute: () => T): T;
  /** Store a value using the configured TTL. */
  set(key: string, value: T): void;
  /** Evict one entry. */
  delete(key: string): void;
  /** Evict all entries. */
  clear(): void;
}

export interface TtlCacheOptions {
  /** How long each entry lives in milliseconds. */
  ttlMs: number;
  /**
   * Maximum number of entries to keep in the map.
   * When exceeded, the oldest inserted key is evicted (FIFO) before inserting the new one.
   */
  maxEntries: number;
}

/**
 * Create a bounded TTL cache for values of type `T`.
 *
 * @example
 * const cache = createTtlCache<MyResult>({ ttlMs: 60_000, maxEntries: 200 });
 * const value = cache.get(key, () => expensiveQuery());
 */
export function createTtlCache<T>(opts: TtlCacheOptions): TtlCache<T> {
  const { ttlMs, maxEntries } = opts;
  // Map preserves insertion order — first key() is the oldest entry.
  const store = new Map<string, CacheEntry<T>>();

  function evictExpired(key: string): void {
    const entry = store.get(key);
    if (entry && Date.now() > entry.expiresAt) {
      store.delete(key);
    }
  }

  function insert(key: string, value: T): void {
    if (store.has(key)) {
      store.delete(key);
    }
    // Enforce size bound: evict the oldest inserted entry (FIFO).
    if (store.size >= maxEntries) {
      const firstKey = store.keys().next().value;
      if (firstKey !== undefined) {
        store.delete(firstKey);
      }
    }
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  return {
    peek(key: string): T | undefined {
      evictExpired(key);
      return store.get(key)?.value;
    },

    get(key: string, compute: () => T): T {
      // Lazily drop the entry if it has expired.
      evictExpired(key);
      const cached = store.get(key);
      if (cached !== undefined) return cached.value;

      const value = compute();
      insert(key, value);
      return value;
    },

    set(key: string, value: T): void {
      insert(key, value);
    },

    delete(key: string): void {
      store.delete(key);
    },

    clear(): void {
      store.clear();
    },
  };
}
