import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/routing';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always', // Always include /bg, /en, etc. in URL
});

export const config = {
  // Apply middleware to all routes except API, assets, etc.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
