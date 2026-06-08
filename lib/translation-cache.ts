const TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  messages: Record<string, Record<string, string>>;
  setAt: number;
}

const cache = new Map<string, CacheEntry>();

export function getCachedTranslations(
  locale: string,
): Record<string, Record<string, string>> | null {
  const entry = cache.get(locale);
  if (!entry) return null;
  if (performance.now() - entry.setAt > TTL_MS) {
    cache.delete(locale);
    return null;
  }
  return entry.messages;
}

export function setCachedTranslations(
  locale: string,
  messages: Record<string, Record<string, string>>,
): void {
  cache.set(locale, { messages, setAt: performance.now() });
}

export function invalidateTranslationCache(): void {
  cache.clear();
}
