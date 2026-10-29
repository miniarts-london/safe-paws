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
    // Hosted databases (Neon) close connections that sit idle, so don't keep them long.
    const p = new pg.Pool({ connectionString, max: 10, idleTimeoutMillis: 10_000 });
    // A connection closed by the database while idle in the pool. Without this
    // listener Node treats it as an uncaught error and stops the whole process;
    // the pool just opens a fresh connection next time.
    p.on("error", (err) => console.warn("Database connection closed while idle:", err.message));
    g.__safePawsPool = p;
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
