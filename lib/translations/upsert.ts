import { db } from '@/db/client';
import { translations } from '@/db/schema';
import { currentIsoTimestamp } from '@/lib/date-format';
import type { Locale } from '@/i18n/routing';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export function upsertTranslation(key: string, locale: Locale, value: string): void {
  const now = currentIsoTimestamp();
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
