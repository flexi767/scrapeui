import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const config: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn2.focus.bg' },
      { protocol: 'https', hostname: 'cdn1.focus.bg' },
      { protocol: 'https', hostname: 'mobistatic1.focus.bg' },
      { protocol: 'https', hostname: 'mobistatic2.focus.bg' },
      { protocol: 'https', hostname: 'mobistatic3.focus.bg' },
      { protocol: 'https', hostname: 'mobistatic4.focus.bg' },
    ],
  },
};

export default withNextIntl(config);
