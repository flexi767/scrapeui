import { createTtlCache } from './ttl-cache';

const TTL_MS = 5 * 60 * 1000; // 5 minutes

type TranslationMessages = Record<string, Record<string, string>>;

const cache = createTtlCache<TranslationMessages | null>({
  ttlMs: TTL_MS,
  maxEntries: 16,
});

export function getCachedTranslations(
  locale: string,
): TranslationMessages | null {
  return cache.peek(locale) ?? null;
}

export function setCachedTranslations(
  locale: string,
  messages: TranslationMessages,
): void {
  cache.set(locale, messages);
}

export function invalidateTranslationCache(): void {
  cache.clear();
}
