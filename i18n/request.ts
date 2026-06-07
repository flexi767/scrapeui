import { getRequestConfig } from 'next-intl/server';
import { getTranslationsFromDb } from './db';

export default getRequestConfig(async ({ locale }) => {
  const messages = await getTranslationsFromDb(locale);
  return { messages };
});
