import { getTranslationsForLocale } from '@/lib/translation-queries';
import {
  getCachedTranslations,
  setCachedTranslations,
} from '@/lib/translation-cache';

export async function getTranslationsFromDb(locale: string) {
  const cached = getCachedTranslations(locale);
  if (cached) return cached;

  const messages: Record<string, Record<string, string>> = {};

  try {
    const rows = getTranslationsForLocale(locale);

    rows.forEach((row) => {
      const firstDot = row.id.indexOf('.');
      if (firstDot === -1) {
        // No namespace — store at top level (rare)
        messages['_'] ??= {};
        messages['_'][row.id] = row.value;
        return;
      }

      const namespace = row.id.substring(0, firstDot);
      // Flatten remaining key: replace all dots with underscores to avoid
      // next-intl treating them as nested path separators
      const key = row.id.substring(firstDot + 1).replace(/\./g, '_');

      messages[namespace] ??= {};
      messages[namespace][key] = row.value;
    });

    setCachedTranslations(locale, messages);
    return messages;
  } catch (error) {
    console.error(`Failed to load translations for locale ${locale}:`, error);
    return {};
  }
}
