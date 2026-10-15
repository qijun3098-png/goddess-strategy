import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanEnvironment, jsonFile, nextTask, OUTPUT, ROOT, run } from './common.mjs';

// 现在执行，无本机时钟任务。任务必须已经获批；工作目录不复制任何 .env。
export async function workNext() {
  const tasksFile = path.join(ROOT, 'scripts/acceptance/tasks.json');
  const queue = JSON.parse(readFileSync(tasksFile, 'utf8'));
  const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const task = nextTask(queue.tasks, sourceSha, (id) => {
    if (!/^[a-z0-9-]+$/.test(id)) return null;
    try { return JSON.parse(readFileSync(path.join(OUTPUT, 'tasks', id, 'result.json'), 'utf8')); } catch { return null; }
  });
  mkdirSync(OUTPUT, { recursive: true });
  if (!task) { const report = { status: 'idle', summary: '没有已批准的待办任务。' }; jsonFile(path.join(OUTPUT, 'work.json'), report); return report; }
  if (!/^[a-z0-9-]+$/.test(task.id) || task.kind !== 'verify') throw new Error('当前首版只自动领取验收任务；开发任务需先定义允许修改范围和验收条件');
  const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
  if (dirty.trim()) throw new Error('先提交已审查的改动，再从确定的提交建立独立验收工作目录');
  const lock = path.join(OUTPUT, 'work.lock');
  mkdirSync(lock);
  const worktree = path.join(OUTPUT, 'worktrees', task.id);
  const priorFile = path.join(OUTPUT, 'tasks', task.id, 'result.json');
  const maxMs = Math.min(Math.max(task.maxDurationSeconds ?? 1800, 60), 1800) * 1000;
  const started = Date.now();
  let added = false;
  try {
    const result = await run('git', ['worktree', 'add', '--detach', worktree, sourceSha]);
    if (result.code !== 0) throw new Error('无法创建独立验收工作目录');
    added = true;
    const installation = await run('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts', '--offline'], { cwd: worktree, env: cleanEnvironment(), timeout: Math.min(180_000, maxMs) });
    if (installation.code !== 0) throw new Error('独立工作目录依赖安装未完成；不会访问生产凭据或自动放宽权限');
    const execution = await run('node', ['scripts/acceptance/review.mjs'], { cwd: worktree, env: cleanEnvironment(), timeout: Math.max(1, maxMs - (Date.now() - started)) });
    const evidenceDir = path.join(OUTPUT, 'tasks', task.id); mkdirSync(evidenceDir, { recursive: true });
    for (const name of ['checks.json', 'review.json']) {
      const file = path.join(worktree, '.acceptance', name);
      if (existsSync(file)) copyFileSync(file, path.join(evidenceDir, name));
    }
    const verdictFile = path.join(evidenceDir, 'review.json');
    const reviewed = existsSync(verdictFile) ? JSON.parse(readFileSync(verdictFile, 'utf8')) : null;
    const report = { taskId: task.id, sourceSha, status: execution.code === 0 && !execution.timedOut && reviewed?.verdict === 'passed' ? 'passed' : 'unverified', durationMs: Date.now() - started, summary: reviewed?.summary ?? '验收未完成', evidence: path.relative(ROOT, evidenceDir) };
    jsonFile(path.join(OUTPUT, 'work.json'), report); jsonFile(priorFile, report); return report;
  } finally {
    if (added) await run('git', ['worktree', 'remove', '--force', worktree]);
    rmSync(lock, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  workNext().then((r) => { console.log(JSON.stringify(r, null, 2)); process.exitCode = ['passed', 'idle'].includes(r.status) ? 0 : 1; }).catch((error) => { jsonFile(path.join(OUTPUT, 'work.json'), { status: 'unverified', summary: error.message }); console.error(error.message); process.exitCode = 1; });
}
