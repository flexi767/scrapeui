import { getTranslationsForLocale } from '@/lib/translation-queries';

export async function getTranslationsFromDb(locale: string) {
  const messages: Record<string, any> = {};

  try {
    const rows = getTranslationsForLocale(locale);

    // Build nested structure: 'nav.listings' → { nav: { listings: '...' } }
    rows.forEach((row) => {
      const keys = row.id.split('.');
      let current = messages;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      const lastKey = keys[keys.length - 1];

      // Handle plural forms
      if (row.pluralForm) {
        if (!current[lastKey]) {
          current[lastKey] = {};
        }
        current[lastKey][row.pluralForm] = row.value;
      } else {
        current[lastKey] = row.value;
      }
    });

    return messages;
  } catch (error) {
    console.error(`Failed to load translations for locale ${locale}:`, error);
    // Return empty object; next-intl will fall back to Bulgarian
    return {};
  }
}
