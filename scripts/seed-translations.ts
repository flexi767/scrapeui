import { db } from '@/db/client';
import { locales, translationKeys, translations } from '@/db/schema';
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
    } catch (error: any) {
      if (!error.message.includes('UNIQUE constraint failed')) {
        console.error(`Error creating key ${key.key}:`, error);
      }
    }

    // Create Bulgarian translation (use extracted English value as fallback)
    try {
      db.insert(translations).values({
        id: nanoid(),
        translationKeyId: key.key,
        localeCode: 'bg',
        value: key.value,
        pluralForm: null,
      }).run();
    } catch (error: any) {
      if (!error.message.includes('UNIQUE constraint failed')) {
        console.error(`Error creating BG translation for ${key.key}:`, error);
      }
    }

    // Create English translation
    try {
      db.insert(translations).values({
        id: nanoid(),
        translationKeyId: key.key,
        localeCode: 'en',
        value: key.value,
        pluralForm: null,
      }).run();
    } catch (error: any) {
      if (!error.message.includes('UNIQUE constraint failed')) {
        console.error(`Error creating EN translation for ${key.key}:`, error);
      }
    }

    // Create German placeholder (same as English for now)
    try {
      db.insert(translations).values({
        id: nanoid(),
        translationKeyId: key.key,
        localeCode: 'de',
        value: key.value,
        pluralForm: null,
      }).run();
    } catch (error: any) {
      if (!error.message.includes('UNIQUE constraint failed')) {
        console.error(`Error creating DE translation for ${key.key}:`, error);
      }
    }

    // Create Russian placeholder (same as English for now)
    try {
      db.insert(translations).values({
        id: nanoid(),
        translationKeyId: key.key,
        localeCode: 'ru',
        value: key.value,
        pluralForm: null,
      }).run();
    } catch (error: any) {
      if (!error.message.includes('UNIQUE constraint failed')) {
        console.error(`Error creating RU translation for ${key.key}:`, error);
      }
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
