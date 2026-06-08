import { db } from '@/db/client';
import { translationKeys, translations } from '@/db/schema';
import { locales, type Locale } from '@/i18n/routing';
import { nanoid } from 'nanoid';
import fs from 'fs';
import path from 'path';

interface ExtractedKey {
  key: string;
  value: string;
  context: string;
  file: string;
  line: number;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('UNIQUE constraint failed');
}

function insertTranslation(localeCode: Locale, key: ExtractedKey): void {
  try {
    db.insert(translations).values({
      id: nanoid(),
      translationKeyId: key.key,
      localeCode,
      value: key.value,
      pluralForm: null,
    }).run();
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      console.error(`Error creating ${localeCode.toUpperCase()} translation for ${key.key}:`, error);
    }
  }
}

async function seedTranslations() {
  console.log('🌱 Seeding translations...\n');

  // Read extracted keys
  const extractedPath = path.join(process.cwd(), 'scripts', 'extracted-keys.json');
  const extracted: ExtractedKey[] = JSON.parse(fs.readFileSync(extractedPath, 'utf-8'));

  console.log(`📝 Processing ${extracted.length} keys...\n`);

  for (const key of extracted) {
    // Create translation_key entry
    try {
      db.insert(translationKeys).values({
        id: key.key,
        context: key.context,
        description: `Extracted from ${path.basename(key.file)}:${key.line}`,
        pluralRules: 0,
      }).run();
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        console.error(`Error creating key ${key.key}:`, error);
      }
    }

    for (const localeCode of locales) {
      insertTranslation(localeCode, key);
    }
  }

  console.log('✅ Seeding complete!\n');

  // Show summary
  const keyCount = db.select().from(translationKeys).all().length;
  const transCount = db.select().from(translations).all().length;
  console.log(`📊 Summary:`);
  console.log(`   Translation keys: ${keyCount}`);
  console.log(`   Translations: ${transCount}`);
}

seedTranslations().catch(console.error);
