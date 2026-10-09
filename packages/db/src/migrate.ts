import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "./pool";

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

/**
 * Applies any migrations in /migrations that haven't run yet, in filename
 * order, each in its own transaction. A lock stops two processes (web and
 * board server starting together) from running them twice.
 */
export async function migrate(log = console.log) {
  const client = await pool().connect();
  try {
    await client.query("select pg_advisory_lock(727011)");
    await client.query(`create table if not exists schema_migrations (
      name text primary key, applied_at timestamptz not null default now())`);
    const done = new Set((await client.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name));
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (name) values ($1)", [file]);
        await client.query("commit");
        log(`[db] applied ${file}`);
      } catch (err) {
        await client.query("rollback");
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
    }
  } finally {
    await client.query("select pg_advisory_unlock(727011)").catch(() => {});
    client.release();
  }
}
