export const locales = ['bg', 'en', 'de', 'ru'] as const;
export const defaultLocale = 'bg' as const;
export type Locale = (typeof locales)[number];
