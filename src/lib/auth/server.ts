import 'server-only';

import { createNeonAuth } from '@neondatabase/auth/next/server';

const baseUrl = process.env.NEON_AUTH_BASE_URL;
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;

if (!baseUrl) {
  throw new Error('缺少 NEON_AUTH_BASE_URL，请从目标 Neon 分支拉取 Auth 环境变量。');
}

if (!cookieSecret || cookieSecret.length < 32) {
  throw new Error('缺少有效的 NEON_AUTH_COOKIE_SECRET，长度至少需要 32 个字符。');
}

export const auth = createNeonAuth({
  baseUrl,
  cookies: {
    secret: cookieSecret,
    sessionDataTtl: 300,
  },
});
