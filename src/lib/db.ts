import 'server-only';

import { Pool } from 'pg';

declare global {
  var goddessStrategyPool: Pool | undefined;
}

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('缺少 DATABASE_URL。');

  if (!globalThis.goddessStrategyPool) {
    globalThis.goddessStrategyPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return globalThis.goddessStrategyPool;
}
