'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { setCookie } from '@/lib/translation-utils';
import { locales, type Locale } from '@/i18n/routing';

const LOCALE_NAMES: Record<Locale, string> = {
  bg: 'Български',
  en: 'English',
  de: 'Deutsch',
  ru: 'Русский',
};

const LOCALE_FLAGS: Record<Locale, string> = {
  bg: '🇧🇬',
  en: '🇬🇧',
  de: '🇩🇪',
  ru: '🇷🇺',
};

function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function LanguageSelector() {
  const t = useTranslations('ui');
  const locale = useLocale();
  const currentLocale = isLocale(locale) ? locale : 'bg';
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const handleChange = (newLocale: Locale) => {
    // Set cookie for persistence
    setCookie('NEXT_LOCALE', newLocale, 365);

    // Navigate to the same path in the new locale
    // Remove current locale from pathname and prepend new locale
    const pathWithoutLocale = pathname.replace(new RegExp(`^/${currentLocale}(?=/|$)`), '');
    const newPath = `/${newLocale}${pathWithoutLocale || ''}`;
    setOpen(false);
    router.push(newPath);
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-7 w-8 items-center justify-center rounded-md border border-gray-700 bg-gray-900 text-[12px] leading-none text-gray-100 hover:bg-gray-800"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('language_label', { name: LOCALE_NAMES[currentLocale] })}
        title={LOCALE_NAMES[currentLocale]}
      >
        <span aria-hidden="true">{LOCALE_FLAGS[currentLocale]}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-32 rounded-md border border-gray-700 bg-gray-950 py-1 text-[11px] shadow-xl shadow-black/30"
        >
          {locales.map((loc) => (
            <button
              key={loc}
              type="button"
              role="menuitemradio"
              aria-checked={loc === currentLocale}
              onClick={() => handleChange(loc)}
              className={cn(
                'flex w-full items-center gap-2 px-2.5 py-1.5 text-left font-medium transition-colors',
                loc === currentLocale
                  ? 'bg-gray-800 text-gray-100'
                  : 'text-gray-400 hover:bg-gray-800/70 hover:text-gray-200',
              )}
            >
              <span className="text-[12px] leading-none" aria-hidden="true">
                {LOCALE_FLAGS[loc]}
              </span>
              <span>{LOCALE_NAMES[loc]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
