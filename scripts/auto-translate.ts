import { raw } from '@/db/client';
import { nanoid } from 'nanoid';

// Simple translation function using Google's free API (no key required)
async function translateText(text: string, targetLang: string): Promise<string> {
  try {
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
    );

    const data = await response.json() as any;
    return data[0][0][0]; // Extract translated text from nested array
  } catch (error) {
    console.error(`Translation failed for "${text}":`, error);
    return text; // Return original if translation fails
  }
}

async function autoTranslate() {
  console.log('🌐 Starting auto-translation for Bulgarian (BG), German (DE) and Russian (RU)...\n');

  // Get all translation keys using raw SQL
  const keys = raw.prepare('SELECT id FROM translation_keys').all() as any[];

  let bgTranslated = 0;
  let deTranslated = 0;
  let ruTranslated = 0;
  let skipped = 0;

  for (const key of keys) {
    // Get existing translations for this key
    const existingTrans = raw
      .prepare('SELECT * FROM translations WHERE translation_key_id = ?')
      .all(key.id) as any[];

    const enTrans = existingTrans.find((t) => t.locale_code === 'en');
    const bgTrans = existingTrans.find((t) => t.locale_code === 'bg');
    const deTrans = existingTrans.find((t) => t.locale_code === 'de');
    const ruTrans = existingTrans.find((t) => t.locale_code === 'ru');

    if (!enTrans) {
      skipped++;
      continue;
    }

    const enValue = enTrans.value;

    // Translate to Bulgarian if missing or is placeholder (same as English)
    if (!bgTrans || bgTrans.value === enValue) {
      console.log(`Translating to BG: "${enValue.substring(0, 50)}..."`);
      const bgValue = await translateText(enValue, 'bg');

      if (bgTrans) {
        raw.prepare(
          'UPDATE translations SET value = ?, updated_at = ? WHERE translation_key_id = ? AND locale_code = ?'
        ).run(bgValue, new Date().toISOString(), key.id, 'bg');
      } else {
        raw.prepare(
          'INSERT INTO translations (id, translation_key_id, locale_code, value, plural_form, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(nanoid(), key.id, 'bg', bgValue, null, new Date().toISOString(), new Date().toISOString());
      }
      bgTranslated++;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Translate to German if missing or is placeholder
    if (!deTrans || deTrans.value === enValue) {
      console.log(`Translating to DE: "${enValue.substring(0, 50)}..."`);
      const deValue = await translateText(enValue, 'de');

      if (deTrans) {
        // Update existing
        raw.prepare(
          'UPDATE translations SET value = ?, updated_at = ? WHERE translation_key_id = ? AND locale_code = ?'
        ).run(deValue, new Date().toISOString(), key.id, 'de');
      } else {
        // Create new
        raw.prepare(
          'INSERT INTO translations (id, translation_key_id, locale_code, value, plural_form, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(
          nanoid(),
          key.id,
          'de',
          deValue,
          null,
          new Date().toISOString(),
          new Date().toISOString()
        );
      }
      deTranslated++;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Translate to Russian if missing or is placeholder
    if (!ruTrans || ruTrans.value === enValue) {
      console.log(`Translating to RU: "${enValue.substring(0, 50)}..."`);
      const ruValue = await translateText(enValue, 'ru');

      if (ruTrans) {
        // Update existing
        raw.prepare(
          'UPDATE translations SET value = ?, updated_at = ? WHERE translation_key_id = ? AND locale_code = ?'
        ).run(ruValue, new Date().toISOString(), key.id, 'ru');
      } else {
        // Create new
        raw.prepare(
          'INSERT INTO translations (id, translation_key_id, locale_code, value, plural_form, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(
          nanoid(),
          key.id,
          'ru',
          ruValue,
          null,
          new Date().toISOString(),
          new Date().toISOString()
        );
      }
      ruTranslated++;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log('\n✅ Auto-translation complete!\n');
  console.log(`📊 Summary:`);
  console.log(`   Bulgarian (BG) translated: ${bgTranslated}`);
  console.log(`   German (DE) translated: ${deTranslated}`);
  console.log(`   Russian (RU) translated: ${ruTranslated}`);
  console.log(`   Skipped (already translated): ${skipped}\n`);
  console.log(`Next steps:`);
  console.log(`1. Review translations in admin UI: /[locale]/(app)/translations`);
  console.log(`2. Edit any translations that need refinement`);
  console.log(`3. Translations will be live immediately\n`);
}

autoTranslate().catch(console.error);
