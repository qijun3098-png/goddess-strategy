import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process, { loadEnvFile } from 'node:process';
import { spawn } from 'node:child_process';

const envFile = path.join(process.cwd(), '.env.auth-dev');
if (!existsSync(envFile)) {
  console.error('缺少 .env.auth-dev，请先从目标 Neon 分支拉取 postgres 与 auth 环境变量。');
  process.exit(1);
}

loadEnvFile(envFile);

const child = spawn(
  process.execPath,
  [path.join(process.cwd(), 'node_modules/next/dist/bin/next'), 'dev', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NEON_AUTH_COOKIE_SECRET: process.env.NEON_AUTH_COOKIE_SECRET || randomBytes(32).toString('base64url'),
    },
  },
);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
