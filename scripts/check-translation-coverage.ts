import { raw } from '@/db/client';
import { getTranslationValuesForKey } from '@/lib/translations/rows';

/**
 * Reports translation_keys that are missing a row for an active locale, or
 * whose non-English value is identical to the English value (a strong sign
 * the key was added but never translated). Exits non-zero when gaps are
 * found so it can be wired into CI.
 */
function main() {
  const locales = raw
    .prepare('SELECT code FROM locales WHERE is_active = 1 ORDER BY code')
    .all() as { code: string }[];
  const localeCodes = locales.map((l) => l.code);
  const otherLocales = localeCodes.filter((c) => c !== 'en');

  const keys = raw.prepare('SELECT id FROM translation_keys ORDER BY id').all() as { id: string }[];

  const missing: { key: string; locale: string }[] = [];
  const untranslated: { key: string; locale: string; value: string }[] = [];

  for (const { id } of keys) {
    const rows = getTranslationValuesForKey(id);
    const byLocale = new Map(rows.map((r) => [r.locale_code, r.value]));
    const enValue = byLocale.get('en');

    for (const locale of localeCodes) {
      if (!byLocale.has(locale)) {
        missing.push({ key: id, locale });
      }
    }

    if (enValue) {
      for (const locale of otherLocales) {
        const value = byLocale.get(locale);
        if (value && value === enValue) {
          untranslated.push({ key: id, locale, value });
        }
      }
    }
  }

  if (missing.length === 0 && untranslated.length === 0) {
    console.log(`✓ All ${keys.length} translation keys have values for every active locale (${localeCodes.join(', ')}).`);
    return;
  }

  if (missing.length > 0) {
    console.log(`\nMissing translations (${missing.length}):`);
    for (const m of missing) console.log(`  ${m.key} — ${m.locale}`);
  }

  if (untranslated.length > 0) {
    console.log(`\nLikely untranslated (same value as English) (${untranslated.length}):`);
    for (const u of untranslated) console.log(`  ${u.key} — ${u.locale}: "${u.value}"`);
  }

  process.exitCode = 1;
}

main();
