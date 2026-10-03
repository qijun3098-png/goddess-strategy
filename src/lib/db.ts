import 'server-only';

import { Pool } from 'pg';

declare global {
  var goddessStrategyPool: Pool | undefined;
}

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('缺少 DATABASE_URL。');

  if (!globalThis.goddessStrategyPool) {
    // Keep certificate and hostname verification explicit across pg upgrades.
    const databaseUrl = new URL(connectionString);
    databaseUrl.searchParams.set('sslmode', 'verify-full');
    globalThis.goddessStrategyPool = new Pool({
      connectionString: databaseUrl.toString(),
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return globalThis.goddessStrategyPool;
}
