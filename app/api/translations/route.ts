import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { translations, translationKeys } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { invalidateTranslationCache } from '@/lib/translation-cache';
import { getTranslationsFromDb } from '@/i18n/db';

const ALL_LOCALES = ['bg', 'en', 'de', 'ru'] as const;

export async function GET() {
  const session = await auth();
  if (!session || session.user?.role !== 'admin') {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Fetch all translation keys with their translations for all locales
    const keys = db.select().from(translationKeys).all();
    const allTranslations = db.select().from(translations).all();

    const result = keys.map((key) => {
      const transForKey = allTranslations.filter(
        (t) => t.translationKeyId === key.id,
      );

      return {
        key: key.id,
        context: key.context,
        description: key.description,
        bg: transForKey.find((t) => t.localeCode === 'bg')?.value || '',
        en: transForKey.find((t) => t.localeCode === 'en')?.value || '',
        de: transForKey.find((t) => t.localeCode === 'de')?.value || '',
        ru: transForKey.find((t) => t.localeCode === 'ru')?.value || '',
      };
    });

    return Response.json(result);
  } catch (error) {
    console.error('Error fetching translations:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session || session.user?.role !== 'admin') {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { key, locale, value } = await request.json();

    if (!key || !locale || value === undefined) {
      return new Response('Missing required fields', { status: 400 });
    }

    // Find or create translation
    const existing = db
      .select()
      .from(translations)
      .where(
        and(
          eq(translations.translationKeyId, key),
          eq(translations.localeCode, locale),
        ),
      )
      .get();

    if (existing) {
      db.update(translations)
        .set({ value, updatedAt: new Date().toISOString() })
        .where(
          and(
            eq(translations.translationKeyId, key),
            eq(translations.localeCode, locale),
          ),
        )
        .run();
    } else {
      db.insert(translations)
        .values({
          id: nanoid(),
          translationKeyId: key,
          localeCode: locale,
          value,
          pluralForm: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .run();
    }

    // Clear stale cache then immediately re-warm all locales so the
    // next page render hits the cache rather than the DB.
    invalidateTranslationCache();
    await Promise.all(ALL_LOCALES.map((l) => getTranslationsFromDb(l)));

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error updating translation:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
