'use client';

import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next-intl/navigation';
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
  const router = useRouter();

  const handleChange = (newLocale: string) => {
    // Set cookie for persistence
    setCookie('NEXT_LOCALE', newLocale, 365);

    // Navigate to the same path in the new locale
    // next-intl/navigation router handles locale prefix automatically
    router.push(window.location.pathname.slice(`/${locale}`.length), { locale: newLocale as any });
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
