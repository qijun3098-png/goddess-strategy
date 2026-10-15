import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { fileHashes, fingerprint, jsonFile, OUTPUT, REQUIRED_CHECKS, ROOT, run, scanSecrets } from './common.mjs';

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.relative(ROOT, path.join(directory, entry.name))]);
}

export async function check() {
  const before = fingerprint();
  const checks = [];
  for (const [name, args] of [['tests', ['test']], ['types', ['typecheck']], ['lint', ['exec', 'eslint', '.', '--max-warnings=0']], ['build', ['build']]]) {
    process.stderr.write(`Checking ${name}…\n`);
    const start = Date.now();
    // 构建只需认证配置形状；使用测试占位值，不访问生产认证或数据库。
    const env = { ...process.env, NEON_AUTH_BASE_URL: 'https://auth.example.test/auth', NEON_AUTH_COOKIE_SECRET: randomBytes(32).toString('hex') };
    const result = await run('pnpm', args, { env });
    checks.push({ name, ...result, durationMs: Date.now() - start });
    if (result.code !== 0) break;
  }
  const tracked = await run('git', ['ls-files', '-z']);
  const trackedEnv = tracked.output.split('\0').filter((name) => /(^|\/)\.env(?:\.|$)/.test(name) && name !== '.env.example');
  const secrets = [...scanSecrets(), ...scanSecrets(walk(path.join(ROOT, '.next/static')))];
  checks.push({ name: 'secrets', code: secrets.length || trackedEnv.length ? 1 : 0, timedOut: false, output: JSON.stringify({ files: [...secrets, ...trackedEnv] }) });
  checks.push({ name: 'diff', ...await run('git', ['diff', '--check']) });
  const after = fingerprint();
  const status = before === after && REQUIRED_CHECKS.every((name) => checks.some((c) => c.name === name && c.code === 0 && !c.timedOut)) ? 'passed' : 'failed';
  const receipt = { version: 1, fingerprint: after, files: fileHashes(), startedFingerprint: before, finishedAt: new Date().toISOString(), status, checks };
  jsonFile(path.join(OUTPUT, 'checks.json'), receipt);
  process.stderr.write(`Checks ${status}; evidence: .acceptance/checks.json\n`);
  return receipt;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  check().then((result) => { process.exitCode = result.status === 'passed' ? 0 : 1; }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
