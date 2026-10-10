/**
 *   npm run db:migrate              apply new migrations
 *   npm run db:seed                 load sample data (skipped if there are already people)
 *   npm run db:demo                 add the demo accounts (and sample animals if the board is empty)
 *                                   to a database that already has real people
 *   npm run db:reset                drop everything, migrate, seed (development only)
 */
import { DEFAULT_DATABASE_URL, closePool } from "./pool";
import { migrate } from "./migrate";
import { dropAll, isEmpty, seed, seedDemo } from "./seed";

async function main() {
  const [command] = process.argv.slice(2);
  const where = (process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL).replace(/\/\/[^@]*@/, "//…@");
  try {
    if (command === "migrate") {
      await migrate();
    } else if (command === "seed") {
      if (await isEmpty()) await seed();
      else console.log("[db] already has data, not seeding (use npm run db:reset to start over)");
    } else if (command === "demo") {
      await seedDemo();
    } else if (command === "reset") {
      if (process.env.NODE_ENV === "production") throw new Error("Refusing to reset a production database.");
      await dropAll();
      await migrate();
      await seed();
    } else {
      throw new Error(`Unknown command "${command}". Use migrate, seed, demo or reset.`);
    }
  } catch (err) {
    const e = err as Error & { code?: string };
    if (e.code === "ECONNREFUSED") {
      console.error(`[db] Can't reach Postgres at ${where}. Start it with "npm run db:up" (Docker) or set DATABASE_URL.`);
    } else {
      console.error(`[db] ${e.message}`);
    }
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

void main();
