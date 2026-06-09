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

interface TranslateRequestBody {
  key?: unknown;
}

export async function POST(request: Request) {
  const check = await requireAdmin();
  if ('error' in check) return check.error;

  try {
    const body = (await request.json()) as TranslateRequestBody;
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
    console.error('Error auto-translating string:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
