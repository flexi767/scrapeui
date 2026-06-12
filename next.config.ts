import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const config: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: '/:locale/d/:slug',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=300',
          },
        ],
      },
      {
        source: '/:locale/d/:slug/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=300, stale-while-revalidate=600',
          },
        ],
      },
    ];
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
