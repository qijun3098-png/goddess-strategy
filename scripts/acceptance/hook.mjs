import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fingerprint, jsonFile, OUTPUT, redact } from './common.mjs';
import { review } from './review.mjs';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
const event = JSON.parse(raw || '{}');
const sessionKey = createHash('sha256').update(String(event.session_id ?? 'manual')).digest('hex').slice(0, 20);
const stateFile = path.join(OUTPUT, 'hooks', `${sessionKey}.json`);
const mode = process.argv[2];
let state = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {};

if (mode === 'start') {
  // 不保存原始用户输入，避免把提示词中的凭据写进材料。
  state = { turnId: event.turn_id ?? null, fingerprint: fingerprint(), continuations: 0 };
  jsonFile(stateFile, state);
  console.log('{}');
} else if (mode === 'stop') {
  const hash = fingerprint();
  if (!state.fingerprint || hash === state.fingerprint) { console.log('{}'); process.exit(0); }
  const lock = path.join(OUTPUT, 'hook.lock');
  mkdirSync(OUTPUT, { recursive: true });
  try { mkdirSync(lock); }
  catch { console.log(JSON.stringify({ systemMessage: '验收已有任务或残留锁，尚未完成；请检查 .acceptance。' })); process.exit(0); }
  try {
    const report = await review();
    if (report.verdict === 'passed') {
      state.fingerprint = hash;
      jsonFile(stateFile, state);
      console.log(JSON.stringify({ systemMessage: '独立验收通过。报告：.acceptance/review.json；线上结果仅以实际证据为准。' }));
    } else if (report.verdict === 'failed' && state.continuations < 2 && !event.stop_hook_active) {
      state.continuations += 1; jsonFile(stateFile, state);
      console.log(JSON.stringify({ decision: 'block', reason: redact(`独立验收未通过，请只修复当前已授权任务中的问题并复验。报告：.acceptance/review.json。${report.summary}`) }));
    } else {
      console.log(JSON.stringify({ systemMessage: `验收${report.verdict === 'failed' ? '两轮后仍未通过' : '尚未完成'}。必须如实报告 .acceptance/review.json 中的剩余问题，不得宣称全部通过。` }));
    }
  } catch {
    console.log(JSON.stringify({ systemMessage: '独立验收运行失败，不能视为通过；请运行 pnpm acceptance 获取诊断。' }));
  } finally { rmSync(lock, { recursive: true, force: true }); }
} else { throw new Error('Unknown hook event'); }
