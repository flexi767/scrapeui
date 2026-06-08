import { translationSourceLocale, type TranslationTargetLocale } from '@/i18n/routing';

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

export async function translateText(text: string, targetLocale: TranslationTargetLocale): Promise<string> {
  const params = new URLSearchParams({
    client: 'gtx',
    sl: translationSourceLocale,
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
