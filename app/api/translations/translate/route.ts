import { z } from 'zod';
import { db } from '@/db/client';
import { translations, translationKeys } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import {
  translationSourceLocale,
  translationTargetLocales,
  type TranslationTargetLocale,
} from '@/i18n/routing';
import { translateText } from '@/lib/translations/google-translate';
import { upsertTranslation } from '@/lib/translations/upsert';
import { requireAdmin } from '@/lib/api/auth-helpers';
import { logger } from '@/lib/logger';

const log = logger.child('api:translations:translate');

const TranslateBodySchema = z.object({
  key: z.unknown().optional(),
}).passthrough();

export async function POST(request: Request) {
  const check = await requireAdmin();
  if ('error' in check) return check.error;

  try {
    const rawBody = await request.json();
    const parsed = TranslateBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data as { key?: unknown };
    const key = typeof body.key === 'string' ? body.key : '';

    if (!key) {
      return new Response('Missing translation key', { status: 400 });
    }

    const keyRow = db
      .select()
      .from(translationKeys)
      .where(eq(translationKeys.id, key))
      .get();

    if (!keyRow) {
      return new Response('Translation key not found', { status: 404 });
    }

    const sourceTranslation = db
      .select()
      .from(translations)
      .where(
        and(
          eq(translations.translationKeyId, key),
          eq(translations.localeCode, translationSourceLocale),
        ),
      )
      .get();

    const sourceText = sourceTranslation?.value?.trim();
    if (!sourceText) {
      return new Response(`${translationSourceLocale.toUpperCase()} source translation is missing`, { status: 400 });
    }

    const translatedValues: Record<TranslationTargetLocale, string> = {
      bg: '',
      de: '',
      ru: '',
    };

    for (const locale of translationTargetLocales) {
      const translated = await translateText(sourceText, locale);
      upsertTranslation(key, locale, translated);
      translatedValues[locale] = translated;
    }

    return Response.json({ key, sourceLocale: translationSourceLocale, translations: translatedValues });
  } catch (error) {
    log.error('Error auto-translating string:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
