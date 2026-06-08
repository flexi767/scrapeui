export const locales = ['bg', 'en', 'de', 'ru'] as const;
export const defaultLocale = 'bg' as const;
export const translationSourceLocale = 'en' as const;
export const translationTargetLocales = ['bg', 'de', 'ru'] as const;
export type Locale = (typeof locales)[number];
export type TranslationTargetLocale = (typeof translationTargetLocales)[number];

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
