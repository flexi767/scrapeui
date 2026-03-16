import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

export default nextConfig;
