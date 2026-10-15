import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
export const OUTPUT = path.join(ROOT, '.acceptance');
const children = new Set();
function terminate(child, signal = 'SIGTERM') {
  try { if (process.platform !== 'win32') process.kill(-child.pid, signal); else child.kill(signal); } catch { /* already exited */ }
}
// 嵌套验收进程也注册清理，超时/用户中断不会留下模型或构建子进程继续运行。
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
  for (const child of children) terminate(child);
  setTimeout(() => { for (const child of children) terminate(child, 'SIGKILL'); process.exit(1); }, 500).unref();
});
process.once('exit', () => { for (const child of children) terminate(child, 'SIGKILL'); });
const PRIVATE = /(^|\/)(\.git|\.acceptance|node_modules|\.next)(\/|$)|(^|\/)\.env(\.|$)|\.(pem|key|p12)$/;

export function sourceFiles(root = ROOT) {
  const names = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root }).toString().split('\0');
  return [...new Set(names)].filter((name) => name && (!PRIVATE.test(name) || name === '.env.example') && existsSync(path.join(root, name))
    && lstatSync(path.join(root, name)).isFile()).sort();
}

export function fingerprint(root = ROOT) {
  const hash = createHash('sha256');
  for (const name of sourceFiles(root)) { hash.update(name); hash.update('\0'); hash.update(readFileSync(path.join(root, name))); }
  return hash.digest('hex');
}

export function fileHashes(root = ROOT) {
  return Object.fromEntries(sourceFiles(root).map((name) => [name, createHash('sha256').update(readFileSync(path.join(root, name))).digest('hex')]));
}

export function normalizeReview(report, execution) {
  if (execution.code !== 0 || execution.timedOut || !report || !['passed', 'failed', 'unverified'].includes(report.verdict)
    || !Array.isArray(report.findings) || !Array.isArray(report.unverified)) {
    return { verdict: 'unverified', summary: execution.timedOut ? '独立审查超时' : '独立审查未完成，请查看脱敏诊断', findings: [], unverified: ['独立审查服务'], diagnostic: execution.output.slice(-3000) };
  }
  if (report.findings.some((f) => ['high', 'medium'].includes(f.severity))) report.verdict = 'failed';
  if (report.unverified.length && report.verdict === 'passed') report.verdict = 'unverified';
  return report;
}

export function privateValues(root = ROOT) {
  const result = [];
  for (const name of readdirSync(root).filter((n) => n.startsWith('.env') && n !== '.env.example')) {
    const file = path.join(root, name);
    if (!lstatSync(file).isFile()) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const match = line.match(/^\s*([\w]+)\s*=\s*(.*)$/);
      if (!match || !/KEY|SECRET|TOKEN|DATABASE_URL/.test(match[1]) || match[1].startsWith('NEXT_PUBLIC_')) continue;
      const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
      if (value.length >= 12) result.push(value);
    }
  }
  return result;
}

export function redact(text, values = privateValues()) {
  let result = String(text).replace(/\x1b\[[0-9;]*m/g, '');
  for (const value of values) result = result.split(value).join('[REDACTED]');
  return result.replace(/\b(?:re_|sk-)[A-Za-z0-9_-]{20,}/g, '[REDACTED]')
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[REDACTED_DATABASE_URL]');
}

export function scanSecrets(files = sourceFiles(), root = ROOT, values = privateValues(root)) {
  const findings = [];
  for (const name of files) {
    const data = readFileSync(path.join(root, name)).toString();
    if (values.some((secret) => data.includes(secret)) || /\b(?:re_|sk-)[A-Za-z0-9_-]{24,}/.test(data)
      || /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(data)) findings.push(name);
  }
  // 只记录文件路径，从不记录发现的凭据。
  return findings;
}

export function jsonFile(file, data) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
}

export function run(command, args, { cwd = ROOT, timeout = 300_000, input, env = process.env } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    children.add(child);
    let output = ''; let timedOut = false; let settled = false;
    let killTimer;
    const stop = () => { terminate(child); killTimer = setTimeout(() => terminate(child, 'SIGKILL'), 750); killTimer.unref(); };
    const timer = setTimeout(() => { timedOut = true; stop(); }, timeout);
    const append = (chunk) => { output = (output + chunk.toString()).slice(-200_000); };
    child.stdout.on('data', append); child.stderr.on('data', append);
    const finish = (code) => { if (settled) return; settled = true; clearTimeout(timer); clearTimeout(killTimer); children.delete(child); resolve({ code, timedOut, output: redact(output) }); };
    child.on('error', (error) => { append(error.message); finish(-1); });
    child.on('close', (code) => finish(code ?? -1));
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}

export function cleanEnvironment() {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|HOME|USER|LOGNAME|TMPDIR|LANG|LC_\w+|CODEX_HOME|SYSTEMROOT)$/.test(key)));
}

export function currentReceipt(receipt, hash, required) {
  return receipt?.fingerprint === hash && receipt?.status === 'passed'
    && required.every((name) => receipt.checks?.some((c) => c.name === name && c.code === 0 && !c.timedOut));
}

export const REQUIRED_CHECKS = ['tests', 'types', 'lint', 'build', 'secrets', 'diff'];

export function nextTask(tasks, sha, resultFor) {
  return tasks.find((task) => task.approved === true && task.status === 'ready'
    && !(resultFor(task.id)?.sourceSha === sha && resultFor(task.id)?.status === 'passed'));
}
