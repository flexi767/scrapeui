import { getRequestConfig } from 'next-intl/server';
import { getTranslationsFromDb } from './db';

export default getRequestConfig(async ({ locale }) => {
  const safeLocale = locale || 'bg';
  const messages = await getTranslationsFromDb(safeLocale);
  return { locale: safeLocale, messages };
});
