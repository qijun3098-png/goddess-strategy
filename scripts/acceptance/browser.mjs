import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const vitePath = require.resolve('vite', { paths: [path.dirname(require.resolve('vitest/package.json'))] });
const { createServer } = await import(vitePath);
const server = await createServer({
  configFile: false, root: process.cwd(),
  server: { host: '127.0.0.1', port: 4175, strictPort: true, fs: { strict: true } },
  define: { 'process.env.NODE_ENV': JSON.stringify('development') },
  resolve: { alias: [
    { find: 'next/image', replacement: path.resolve('tests/browser/image.tsx') },
    { find: 'next/navigation', replacement: path.resolve('tests/browser/navigation.ts') },
    { find: '@/lib/auth/client', replacement: path.resolve('tests/browser/auth.ts') },
    { find: '@', replacement: path.resolve('src') },
  ] },
});
await server.listen();
console.log('Local simulated browser acceptance: http://127.0.0.1:4175/tests/browser/');
