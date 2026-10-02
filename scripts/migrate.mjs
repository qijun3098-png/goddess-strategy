import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { Client } from 'pg';

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');
const LOCK_NAME = 'goddess-strategy-schema-migrations';
const COMMANDS = new Set(['up', 'status', 'down']);

function fail(message) {
  throw new Error(message);
}

function parseMigration(filename, source) {
  const match = /^(\d+)_([a-z0-9_-]+)\.sql$/i.exec(filename);
  if (!match) fail(`迁移文件名不合法：${filename}，应为 001_description.sql`);

  const upMarker = '-- migrate:up';
  const downMarker = '-- migrate:down';
  const upIndex = source.indexOf(upMarker);
  const downIndex = source.indexOf(downMarker);
  if (upIndex < 0 || downIndex < 0 || downIndex <= upIndex) {
    fail(`迁移 ${filename} 必须依次包含 ${upMarker} 和 ${downMarker}`);
  }

  const version = Number(match[1]);
  if (!Number.isSafeInteger(version)) fail(`迁移版本超出安全整数范围：${filename}`);

  const up = source.slice(upIndex + upMarker.length, downIndex).trim();
  const down = source.slice(downIndex + downMarker.length).trim();
  if (!up || !down) fail(`迁移 ${filename} 的 up/down SQL 不能为空`);

  return {
    version,
    name: filename,
    checksum: createHash('sha256').update(source).digest('hex'),
    up,
    down,
  };
}

async function loadMigrations() {
  const filenames = (await readdir(MIGRATIONS_DIR))
    .filter((filename) => filename.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right, 'en'));
  const migrations = await Promise.all(
    filenames.map(async (filename) => parseMigration(filename, await readFile(path.join(MIGRATIONS_DIR, filename), 'utf8'))),
  );

  const versions = new Set();
  for (const migration of migrations) {
    if (versions.has(migration.version)) fail(`存在重复迁移版本：${migration.version}`);
    versions.add(migration.version);
  }
  return migrations.sort((left, right) => left.version - right.version);
}

function getConnectionString() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED;
  if (!connectionString) {
    fail('缺少 DATABASE_URL_UNPOOLED。Migration 必须使用 Neon 直连地址。');
  }

  let url;
  try {
    url = new URL(connectionString);
  } catch {
    fail('DATABASE_URL_UNPOOLED 不是合法的 PostgreSQL 连接字符串。');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) fail('数据库连接必须使用 postgres:// 或 postgresql://。');
  if (url.hostname.includes('-pooler')) fail('检测到 pooled 地址；Migration 必须使用不含 -pooler 的直连地址。');
  url.searchParams.set('sslmode', 'verify-full');
  return url.toString();
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      version bigint PRIMARY KEY,
      name text NOT NULL UNIQUE,
      checksum char(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now(),
      execution_ms integer NOT NULL CHECK (execution_ms >= 0)
    )
  `);
}

async function loadApplied(client) {
  const result = await client.query(`
    SELECT version::text, name, checksum, applied_at, execution_ms
    FROM public.schema_migrations
    ORDER BY version
  `);
  return result.rows.map((row) => ({ ...row, version: Number(row.version) }));
}

async function migrationTableExists(client) {
  const result = await client.query(`SELECT to_regclass('public.schema_migrations') IS NOT NULL AS exists`);
  return result.rows[0]?.exists === true;
}

function compareMigrations(migrations, applied) {
  const localByVersion = new Map(migrations.map((migration) => [migration.version, migration]));
  const appliedByVersion = new Map(applied.map((migration) => [migration.version, migration]));
  const rows = migrations.map((migration) => {
    const database = appliedByVersion.get(migration.version);
    const state = !database ? 'pending' : database.checksum === migration.checksum ? 'applied' : 'drift';
    return { ...migration, database, state };
  });
  const unknown = applied.filter((migration) => !localByVersion.has(migration.version));
  return { rows, unknown };
}

function printStatus(comparison) {
  console.log('VERSION  STATE    NAME');
  for (const row of comparison.rows) {
    console.log(`${String(row.version).padStart(7, '0')}  ${row.state.padEnd(8)} ${row.name}`);
  }
  for (const row of comparison.unknown) {
    console.log(`${String(row.version).padStart(7, '0')}  unknown  ${row.name}`);
  }
  if (!comparison.rows.length && !comparison.unknown.length) console.log('(没有迁移文件)');
}

function assertNoDrift(comparison) {
  const drift = comparison.rows.filter((row) => row.state === 'drift');
  if (drift.length) fail(`已执行迁移被修改：${drift.map((row) => row.name).join(', ')}`);
  if (comparison.unknown.length) {
    fail(`数据库存在本地缺失的迁移：${comparison.unknown.map((row) => row.name).join(', ')}`);
  }
}

async function migrateUp(client, migrations) {
  const applied = await loadApplied(client);
  const comparison = compareMigrations(migrations, applied);
  assertNoDrift(comparison);
  const pending = comparison.rows.filter((row) => row.state === 'pending');
  if (!pending.length) {
    console.log('数据库已是最新版本。');
    return;
  }

  for (const migration of pending) {
    const startedAt = performance.now();
    await client.query('BEGIN');
    try {
      await client.query(migration.up);
      const executionMs = Math.max(0, Math.round(performance.now() - startedAt));
      await client.query(
        `INSERT INTO public.schema_migrations (version, name, checksum, execution_ms)
         VALUES ($1, $2, $3, $4)`,
        [migration.version, migration.name, migration.checksum, executionMs],
      );
      await client.query('COMMIT');
      console.log(`✓ applied ${migration.name} (${executionMs} ms)`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
}

async function migrateDown(client, migrations) {
  const applied = await loadApplied(client);
  const comparison = compareMigrations(migrations, applied);
  assertNoDrift(comparison);
  const latest = [...comparison.rows].reverse().find((row) => row.state === 'applied');
  if (!latest) {
    console.log('没有可回滚的迁移。');
    return;
  }

  const startedAt = performance.now();
  await client.query('BEGIN');
  try {
    await client.query(latest.down);
    await client.query('DELETE FROM public.schema_migrations WHERE version = $1', [latest.version]);
    await client.query('COMMIT');
    console.log(`✓ rolled back ${latest.name} (${Math.max(0, Math.round(performance.now() - startedAt))} ms)`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  const command = process.argv[2] ?? 'up';
  if (!COMMANDS.has(command)) fail(`未知命令：${command}。可用命令：up、status、down。`);

  const migrations = await loadMigrations();
  const client = new Client({ connectionString: getConnectionString() });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [LOCK_NAME]);
    if (command === 'status') {
      const applied = await migrationTableExists(client) ? await loadApplied(client) : [];
      const comparison = compareMigrations(migrations, applied);
      printStatus(comparison);
      assertNoDrift(comparison);
      return;
    }
    await ensureMigrationTable(client);
    if (command === 'up') await migrateUp(client, migrations);
    if (command === 'down') await migrateDown(client, migrations);
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_NAME]).catch(() => undefined);
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Migration 失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
