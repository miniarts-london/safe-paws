import pg from "pg";

/**
 * One connection pool per process. In development Next.js reloads modules on
 * every edit, so the pool lives on globalThis instead of leaking a new one each time.
 */
export const DEFAULT_DATABASE_URL = "postgres://safepaws:safepaws@localhost:5432/safepaws";

const g = globalThis as typeof globalThis & { __safePawsPool?: pg.Pool };

export function pool(): pg.Pool {
  if (!g.__safePawsPool) {
    const connectionString = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
    if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL must be set in production.");
    }
    g.__safePawsPool = new pg.Pool({ connectionString, max: 10 });
  }
  return g.__safePawsPool;
}

export type Tx = pg.PoolClient;

/** Runs `fn` in a transaction: everything commits together or nothing does. */
export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await g.__safePawsPool?.end();
  g.__safePawsPool = undefined;
}
