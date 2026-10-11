import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 固定项目根目录，避免上级目录的 lockfile 干扰构建。
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.volces.com' },
      { protocol: 'https', hostname: '**.volcengine.com' },
    ],
  },
};

export default nextConfig;
