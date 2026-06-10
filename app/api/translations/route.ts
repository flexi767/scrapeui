import { z } from 'zod';
import { db } from '@/db/client';
import { translations, translationKeys } from '@/db/schema';
import { invalidateTranslationCache } from '@/lib/translation-cache';
import { getTranslationsFromDb } from '@/i18n/db';
import { isLocale, locales, type Locale } from '@/i18n/routing';
import { upsertTranslation } from '@/lib/translations/upsert';
import { requireAdmin } from '@/lib/api/auth-helpers';
import { logger } from '@/lib/logger';

const log = logger.child('api:translations');

const UpdateTranslationSchema = z.object({
  key: z.string(),
  locale: z.string(),
  value: z.string(),
}).passthrough();

export async function GET() {
  const check = await requireAdmin();
  if ('error' in check) return check.error;

  try {
    // Fetch all translation keys with their translations for all locales
    const keys = db.select().from(translationKeys).all();
    const allTranslations = db.select().from(translations).all();
    const translationsByKey = new Map<string, Partial<Record<Locale, string>>>();

    for (const translation of allTranslations) {
      if (!isLocale(translation.localeCode)) continue;
      const values = translationsByKey.get(translation.translationKeyId) ?? {};
      values[translation.localeCode] = translation.value;
      translationsByKey.set(translation.translationKeyId, values);
    }

    const result = keys.map((key) => {
      const values = translationsByKey.get(key.id);
      return {
        key: key.id,
        context: key.context,
        description: key.description,
        bg: values?.bg || '',
        en: values?.en || '',
        de: values?.de || '',
        ru: values?.ru || '',
      };
    });

    return Response.json(result);
  } catch (error) {
    log.error('Error fetching translations:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function PUT(request: Request) {
  const check = await requireAdmin();
  if ('error' in check) return check.error;

  try {
    const rawBody = await request.json();
    const parsed = UpdateTranslationSchema.safeParse(rawBody);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
    }
    const { key, locale, value } = parsed.data;

    if (!key || !locale || value === undefined) {
      return new Response('Missing required fields', { status: 400 });
    }
    if (!isLocale(locale)) {
      return new Response('Invalid translation payload', { status: 400 });
    }

    upsertTranslation(key, locale, value);

    // Clear stale cache then immediately re-warm all locales so the
    // next page render hits the cache rather than the DB.
    invalidateTranslationCache();
    await Promise.all(locales.map((l) => getTranslationsFromDb(l)));

    return Response.json({ success: true });
  } catch (error) {
    log.error('Error updating translation:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
