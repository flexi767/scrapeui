import { auth } from '@/lib/auth';
import { db } from '@/db/client';
import { translations, translationKeys } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

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
        (t) => t.translation_key_id === key.id,
      );

      return {
        key: key.id,
        context: key.context,
        description: key.description,
        bg: transForKey.find((t) => t.locale_code === 'bg')?.value || '',
        en: transForKey.find((t) => t.locale_code === 'en')?.value || '',
        de: transForKey.find((t) => t.locale_code === 'de')?.value || '',
        ru: transForKey.find((t) => t.locale_code === 'ru')?.value || '',
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
          eq(translations.translation_key_id, key),
          eq(translations.locale_code, locale),
        ),
      )
      .get();

    if (existing) {
      db.update(translations)
        .set({ value, updated_at: new Date().toISOString() })
        .where(
          and(
            eq(translations.translation_key_id, key),
            eq(translations.locale_code, locale),
          ),
        )
        .run();
    } else {
      db.insert(translations)
        .values({
          id: nanoid(),
          translation_key_id: key,
          locale_code: locale,
          value,
          plural_form: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .run();
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error updating translation:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
