import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { check } from './check.mjs';
import { cleanEnvironment, currentReceipt, fingerprint, jsonFile, normalizeReview, OUTPUT, REQUIRED_CHECKS, ROOT, run, scanSecrets, sourceFiles } from './common.mjs';

export async function review() {
  const hash = fingerprint();
  const receiptFile = path.join(OUTPUT, 'checks.json');
  let receipt = existsSync(receiptFile) ? JSON.parse(readFileSync(receiptFile, 'utf8')) : null;
  if (!currentReceipt(receipt, hash, REQUIRED_CHECKS) || !receipt.files) receipt = await check();
  if (!currentReceipt(receipt, fingerprint(), REQUIRED_CHECKS)) {
    const result = { verdict: 'failed', summary: '自动检查未通过或代码发生变化；未调用审查模型。', findings: [], unverified: [], fingerprint: fingerprint() };
    jsonFile(path.join(OUTPUT, 'review.json'), result); return result;
  }
  const files = sourceFiles().filter((name) => /^(src\/|tests\/|scripts\/acceptance\/|docs\/|\.codex\/hooks\.json$|AGENTS\.md$|package\.json$|vitest\.config\.)/.test(name));
  if (scanSecrets(files).length) throw new Error('审查材料含疑似凭据，已停止');
  const snapshot = mkdtempSync(path.join(tmpdir(), 'goddess-review-'));
  const resultFile = path.join(OUTPUT, 'review-output.json');
  rmSync(resultFile, { force: true });
  try {
    for (const name of files) {
      mkdirSync(path.dirname(path.join(snapshot, name)), { recursive: true }); copyFileSync(path.join(ROOT, name), path.join(snapshot, name));
      if (createHash('sha256').update(readFileSync(path.join(snapshot, name))).digest('hex') !== receipt.files[name]) throw new Error('快照与检查收据不一致，停止审查');
    }
    jsonFile(path.join(snapshot, 'snapshot-manifest.json'), Object.fromEntries(files.map((name) => [name, receipt.files[name]])));
    jsonFile(path.join(snapshot, 'check-evidence.json'), receipt);
    const instructions = readFileSync(path.join(ROOT, 'scripts/acceptance/reviewer.md'), 'utf8');
    const scope = existsSync(path.join(ROOT, 'docs/iteration-acceptance.md')) ? readFileSync(path.join(ROOT, 'docs/iteration-acceptance.md'), 'utf8') : '审查当前任务及改动。';
    process.stderr.write('Starting independent read-only Codex review…\n');
    const result = await run('codex', ['exec', '--ignore-user-config', '--ephemeral', '--disable', 'hooks', '--sandbox', 'read-only', '--skip-git-repo-check', '-C', snapshot,
      '--output-schema', path.join(ROOT, 'scripts/acceptance/report.schema.json'), '-o', resultFile, '-'], { timeout: 240_000, env: cleanEnvironment(), input: `${instructions}\n\n本轮验收范围：\n${scope}\n检查 check-evidence.json 并自己阅读相关代码。` });
    let report;
    try { report = JSON.parse(readFileSync(resultFile, 'utf8')); } catch { /* reported below */ }
    report = normalizeReview(report, result);
    if (fingerprint() !== receipt.fingerprint) { report.verdict = 'unverified'; report.unverified.push('检查后代码已变化'); }
    report.fingerprint = receipt.fingerprint; report.finishedAt = new Date().toISOString();
    jsonFile(path.join(OUTPUT, 'review.json'), report);
    return report;
  } finally { rmSync(snapshot, { recursive: true, force: true }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  review().then((r) => { console.log(JSON.stringify(r, null, 2)); process.exitCode = r.verdict === 'passed' ? 0 : 1; }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
