import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { translations, translationKeys } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const SOURCE_LOCALE = 'en';
const TARGET_LOCALES = ['bg', 'de', 'ru'] as const;

type TargetLocale = (typeof TARGET_LOCALES)[number];

interface TranslateRequestBody {
  key?: unknown;
}

function extractTranslatedText(data: unknown): string | null {
  if (!Array.isArray(data)) return null;
  const sentences = data[0];
  if (!Array.isArray(sentences)) return null;

  return sentences
    .map((sentence) => {
      if (!Array.isArray(sentence)) return '';
      return typeof sentence[0] === 'string' ? sentence[0] : '';
    })
    .join('');
}

async function translateText(text: string, targetLocale: TargetLocale): Promise<string> {
  const params = new URLSearchParams({
    client: 'gtx',
    sl: SOURCE_LOCALE,
    tl: targetLocale,
    dt: 't',
    q: text,
  });

  const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Translate request failed with ${response.status}`);
  }

  const translated = extractTranslatedText(await response.json());
  if (!translated) {
    throw new Error('Translate response did not include translated text');
  }

  return translated;
}

function upsertTranslation(key: string, locale: TargetLocale, value: string) {
  const now = new Date().toISOString();
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
      .set({ value, updatedAt: now })
      .where(
        and(
          eq(translations.translationKeyId, key),
          eq(translations.localeCode, locale),
        ),
      )
      .run();
    return;
  }

  db.insert(translations)
    .values({
      id: nanoid(),
      translationKeyId: key,
      localeCode: locale,
      value,
      pluralForm: null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session || session.user?.role !== 'admin') {
    return new Response('Unauthorized', { status: 401 });
  }

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
          eq(translations.localeCode, SOURCE_LOCALE),
        ),
      )
      .get();

    const sourceText = sourceTranslation?.value?.trim();
    if (!sourceText) {
      return new Response('English source translation is missing', { status: 400 });
    }

    const translatedValues: Record<TargetLocale, string> = {
      bg: '',
      de: '',
      ru: '',
    };

    for (const locale of TARGET_LOCALES) {
      const translated = await translateText(sourceText, locale);
      upsertTranslation(key, locale, translated);
      translatedValues[locale] = translated;
    }

    return Response.json({ key, sourceLocale: SOURCE_LOCALE, translations: translatedValues });
  } catch (error) {
    console.error('Error auto-translating string:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
