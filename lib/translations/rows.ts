import { raw } from '@/db/client';

export interface TranslationValueRow {
  locale_code: string;
  value: string;
}

export function getTranslationValuesForKey(keyId: string): TranslationValueRow[] {
  return raw
    .prepare('SELECT locale_code, value FROM translations WHERE translation_key_id = ?')
    .all(keyId) as TranslationValueRow[];
}
