import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { translations, translationKeys, locales } from '@/db/schema';

export function getTranslationsForLocale(locale: string) {
  const rows = db
    .select({
      id: translationKeys.id,
      value: translations.value,
      plural_form: translations.plural_form,
    })
    .from(translations)
    .innerJoin(
      translationKeys,
      eq(translations.translationKeyId, translationKeys.id),
    )
    .where(
      and(
        eq(translations.localeCode, locale),
        eq(locales.isActive, 1),
      ),
    )
    .all();

  return rows;
}
