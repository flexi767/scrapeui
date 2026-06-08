import { raw } from '@/db/client';
import {
  translationSourceLocale,
  translationTargetLocales,
  type TranslationTargetLocale,
} from '@/i18n/routing';
import { getTranslationValuesForKey, type TranslationValueRow } from '@/lib/translations/rows';
import { translateText } from '@/lib/translations/google-translate';
import { upsertTranslation } from '@/lib/translations/upsert';

interface TranslationKeyRow {
  id: string;
}

const SUMMARY_LABELS: Record<TranslationTargetLocale, string> = {
  bg: 'Bulgarian (BG)',
  de: 'German (DE)',
  ru: 'Russian (RU)',
};

const TARGET_LOCALES = translationTargetLocales.map((code) => ({
  code,
  summaryLabel: SUMMARY_LABELS[code],
}));

type TranslationCounts = Record<TranslationTargetLocale, number>;

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function translateWithFallback(text: string, targetLocale: TranslationTargetLocale): Promise<string> {
  try {
    return await translateText(text, targetLocale);
  } catch (error) {
    console.error(`Translation failed for "${text}":`, error);
    return text;
  }
}

async function ensureTranslation(params: {
  existing: TranslationValueRow | undefined;
  keyId: string;
  locale: TranslationTargetLocale;
  englishValue: string;
}): Promise<boolean> {
  if (params.existing && params.existing.value !== params.englishValue) {
    return false;
  }

  console.log(`Translating to ${params.locale.toUpperCase()}: "${params.englishValue.substring(0, 50)}..."`);
  const translatedValue = await translateWithFallback(params.englishValue, params.locale);
  upsertTranslation(params.keyId, params.locale, translatedValue);

  await delay(100);
  return true;
}

async function autoTranslate() {
  console.log('🌐 Starting auto-translation for Bulgarian (BG), German (DE) and Russian (RU)...\n');

  // Get all translation keys using raw SQL
  const keys = raw.prepare('SELECT id FROM translation_keys').all() as TranslationKeyRow[];

  const translatedCounts: TranslationCounts = { bg: 0, de: 0, ru: 0 };
  let skipped = 0;

  for (const key of keys) {
    // Get existing translations for this key
    const existingTrans = getTranslationValuesForKey(key.id);

    const enTrans = existingTrans.find((t) => t.locale_code === translationSourceLocale);

    if (!enTrans) {
      skipped++;
      continue;
    }

    const enValue = enTrans.value;
    const existingByLocale = new Map(existingTrans.map((translation) => [
      translation.locale_code,
      translation,
    ]));

    for (const target of TARGET_LOCALES) {
      const didTranslate = await ensureTranslation({
        existing: existingByLocale.get(target.code),
        keyId: key.id,
        locale: target.code,
        englishValue: enValue,
      });
      if (didTranslate) {
        translatedCounts[target.code]++;
      }
    }
  }

  console.log('\n✅ Auto-translation complete!\n');
  console.log(`📊 Summary:`);
  for (const target of TARGET_LOCALES) {
    console.log(`   ${target.summaryLabel} translated: ${translatedCounts[target.code]}`);
  }
  console.log(`   Skipped (already translated): ${skipped}\n`);
  console.log(`Next steps:`);
  console.log(`1. Review translations in admin UI: /[locale]/(app)/translations`);
  console.log(`2. Edit any translations that need refinement`);
  console.log(`3. Translations will be live immediately\n`);
}

autoTranslate().catch(console.error);
