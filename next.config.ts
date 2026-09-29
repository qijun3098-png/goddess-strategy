import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.volces.com' },
      { protocol: 'https', hostname: '**.volcengine.com' },
    ],
  },
};

export default nextConfig;
