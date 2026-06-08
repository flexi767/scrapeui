import { getRequestConfig } from 'next-intl/server';
import { getTranslationsFromDb } from './db';
import { defaultLocale, isLocale } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale is a Promise in next-intl v4 — resolves from setRequestLocale() in layout
  let locale = await requestLocale;

  // Fall back to default if locale is missing or unsupported
  if (!locale || !isLocale(locale)) {
    locale = defaultLocale;
  }

  const messages = await getTranslationsFromDb(locale);
  return { locale, messages };
});
