import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { currentReceipt, nextTask, normalizeReview, redact, run, scanSecrets } from '../scripts/acceptance/common.mjs';

test('旧代码的绿色检查不能用于新代码；缺项或失败不能通过', () => {
  const receipt = { fingerprint: 'old', status: 'passed', checks: [{ name: 'tests', code: 0, timedOut: false }] };
  assert.equal(currentReceipt(receipt, 'new', ['tests']), false);
  assert.equal(currentReceipt(receipt, 'old', ['tests', 'build']), false);
  assert.equal(currentReceipt(receipt, 'old', ['tests']), true);
  receipt.checks[0].code = 1;
  assert.equal(currentReceipt(receipt, 'old', ['tests']), false);
});

test('模型失败/超时和缺失证据不能变成通过', () => {
  const ok = { verdict: 'passed', summary: 'ok', findings: [], unverified: [] };
  assert.equal(normalizeReview({ ...ok }, { code: 1, timedOut: false, output: '' }).verdict, 'unverified');
  assert.equal(normalizeReview({ ...ok }, { code: -1, timedOut: true, output: '' }).summary, '独立审查超时');
  assert.equal(normalizeReview({ ...ok }, { code: 0, timedOut: true, output: '' }).verdict, 'unverified');
  assert.equal(normalizeReview({ ...ok, unverified: ['缺少证据'] }, { code: 0, output: '' }).verdict, 'unverified');
  assert.equal(normalizeReview({ ...ok, findings: [{ severity: 'medium' }] }, { code: 0, output: '' }).verdict, 'failed');
});

test('已完成的首项不会阻塞后续已批准任务；未批准任务不领取', () => {
  const tasks = [{ id: 'first', approved: true, status: 'ready' }, { id: 'unapproved', approved: false, status: 'ready' }, { id: 'second', approved: true, status: 'ready' }];
  const completed = (id) => id === 'first' ? { status: 'passed', sourceSha: 'sha' } : null;
  assert.equal(nextTask(tasks, 'sha', completed).id, 'second');
  assert.equal(nextTask(tasks.slice(0, 2), 'sha', completed), undefined);
  assert.equal(nextTask(tasks, 'new-sha', completed).id, 'first');
});

test('子进程超时会结束并明确标记失败', async () => {
  const result = await run(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { timeout: 100 });
  assert.equal(result.timedOut, true); assert.notEqual(result.code, 0);
});

test('Hook 无代码变更时跳过模型；状态按会话隔离且不保存用户原文', async () => {
  const session = 'acceptance-hook-self-test';
  const key = createHash('sha256').update(session).digest('hex').slice(0, 20);
  const stateFile = path.resolve('.acceptance/hooks', `${key}.json`);
  try {
    const event = { session_id: session, turn_id: 'self-test', prompt: 'private-prompt-not-to-save' };
    const start = await run(process.execPath, ['scripts/acceptance/hook.mjs', 'start'], { input: JSON.stringify(event), timeout: 10_000 });
    assert.equal(start.code, 0); assert.deepEqual(JSON.parse(start.output), {});
    assert.equal(readFileSync(stateFile, 'utf8').includes(event.prompt), false);
    const stop = await run(process.execPath, ['scripts/acceptance/hook.mjs', 'stop'], { input: JSON.stringify(event), timeout: 10_000 });
    assert.equal(stop.code, 0); assert.deepEqual(JSON.parse(stop.output), {});
  } finally { rmSync(stateFile, { force: true }); }
});

test('已配置的凭据被发现，但不会写入扫描结果或脱敏日志', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'acceptance-secret-test-'));
  try {
    mkdirSync(path.join(root, 'src'));
    const fake = ['test', 'credential', 'fixture'].join('-');
    writeFileSync(path.join(root, 'src/leak.ts'), `const value = '${fake}'`);
    assert.deepEqual(scanSecrets(['src/leak.ts'], root, [fake]), ['src/leak.ts']);
    assert.equal(redact(`request failed: ${fake}`, [fake]), 'request failed: [REDACTED]');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
