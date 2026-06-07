'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { setCookie } from '@/lib/translation-utils';

const LOCALES = ['bg', 'en', 'de', 'ru'] as const;
const LOCALE_NAMES: Record<(typeof LOCALES)[number], string> = {
  bg: 'Български',
  en: 'English',
  de: 'Deutsch',
  ru: 'Русский',
};

export function LanguageSelector() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const handleChange = (newLocale: string) => {
    // Set cookie for persistence
    setCookie('NEXT_LOCALE', newLocale, 365);

    // Navigate to the same path in the new locale
    // Remove current locale from pathname and prepend new locale
    const pathWithoutLocale = pathname.replace(`/${locale}`, '');
    const newPath = `/${newLocale}${pathWithoutLocale || ''}`;
    router.push(newPath);
  };

  return (
    <select
      value={locale}
      onChange={(e) => handleChange(e.target.value)}
      className="px-2 py-1 bg-gray-800 text-gray-100 border border-gray-600 rounded cursor-pointer"
    >
      {LOCALES.map((loc) => (
        <option key={loc} value={loc}>
          {LOCALE_NAMES[loc]}
        </option>
      ))}
    </select>
  );
}
